"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  Database,
  HardDrive,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Server,
  Layers,
  FileText,
  Clock,
  Play,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface HealthData {
  status: string;
  system: string;
  database: {
    connected: boolean;
    engine: string;
    file_size_bytes: number;
    revision: number;
  };
  backup: {
    last_backup_date: string | null;
    last_backup_status: string;
    last_backup_file: string | null;
    total_backups_count: number;
  };
  accounting_integrity: {
    is_all_balanced: boolean;
    gl_balanced: boolean;
    bank_balanced: boolean;
    transport_balanced: boolean;
  };
  disk_storage: {
    total_bytes: number;
    free_bytes: number;
    pct_free: number;
    status: string;
  };
  documents: {
    count: number;
    storage_path: string;
    directory_exists: boolean;
  };
  api_status: string;
  timestamp: string;
}

export default function SystemHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState(false);
  const [jobResult, setJobResult] = useState<any | null>(null);
  const [integrityDetails, setIntegrityDetails] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const loadHealth = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await fetchApi<HealthData>("/system/health");
      setData(res);

      // Load full integrity breakdown
      const integ = await fetchApi<any>("/accounting/health-check");
      setIntegrityDetails(integ);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load system health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const handleRunDailyJob = async () => {
    try {
      setRunningJob(true);
      setErrorMsg("");
      setJobResult(null);
      const res = await fetchApi<any>("/accounting/daily-job/run", { method: "POST" });
      setJobResult(res);
      loadHealth();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to execute daily job");
    } finally {
      setRunningJob(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Activity className="w-7 h-7 text-sky-600" />
            System Health & Accounting Integrity
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-Time Engine Diagnostics • Database Revision • Storage Monitoring • Subledger Health Checks
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadHealth}
            disabled={loading}
            className="btn btn-secondary text-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>

          <button
            onClick={handleRunDailyJob}
            disabled={runningJob}
            className="btn btn-primary text-xs flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Play className={`w-3.5 h-3.5 ${runningJob ? "animate-spin" : ""}`} /> Run Daily Maintenance Job
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      {jobResult && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm rounded-xl space-y-1">
          <div className="font-bold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Automated Daily Job Completed Successfully
          </div>
          <div className="text-xs text-emerald-800 dark:text-emerald-300 pl-7">
            Invoices refreshed: {jobResult.invoices_status_refreshed} | Pending Afghan shipments monitored: {jobResult.pending_purchase_shipments} | Health verified.
          </div>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Database Connection */}
        <div className="card p-5 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Database Status</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {data?.database.connected ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                CONNECTED
              </>
            ) : (
              "OFFLINE"
            )}
          </div>
          <div className="text-xs text-slate-500">
            {data?.database.engine} • {((data?.database.file_size_bytes || 0) / (1024 * 1024)).toFixed(2)} MB
          </div>
        </div>

        {/* Card 2: Database Revision */}
        <div className="card p-5 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Database Revision</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 font-mono">
            REV #{data?.database.revision ?? "—"}
          </div>
          <div className="text-xs text-slate-500">
            Increments on every committed accounting transaction
          </div>
        </div>

        {/* Card 3: Accounting Integrity */}
        <div className="card p-5 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Accounting Integrity</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {data?.accounting_integrity.is_all_balanced ? (
              <span className="text-emerald-600">BALANCED ($0.00 Diff)</span>
            ) : (
              <span className="text-amber-600">DISCREPANCY DETECTED</span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            GL: {data?.accounting_integrity.gl_balanced ? "✓ Balanced" : "⚠ Discrepancy"} • Carrier: {data?.accounting_integrity.transport_balanced ? "✓ Verified" : "⚠ Discrepancy"}
          </div>
        </div>

        {/* Card 4: Local Storage */}
        <div className="card p-5 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Disk Space Available</span>
            <HardDrive className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">
            {data?.disk_storage.pct_free}% Free
          </div>
          <div className="text-xs text-slate-500">
            {((data?.disk_storage.free_bytes || 0) / (1024 * 1024 * 1024)).toFixed(1)} GB free of {((data?.disk_storage.total_bytes || 0) / (1024 * 1024 * 1024)).toFixed(1)} GB
          </div>
        </div>
      </div>

      {/* Subledger Health Matrix */}
      {integrityDetails && (
        <div className="card p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Subledger to General Ledger Reconciliation Matrix (Sections 19 & 20)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {Object.entries(integrityDetails.checks || {}).map(([moduleName, check]: [string, any]) => (
              <div
                key={moduleName}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {moduleName.replace("_", " ")}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      check.status === "BALANCED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  {check.total_debit !== undefined && (
                    <div>Dr / Cr: ${check.total_debit?.toLocaleString()} / ${check.total_credit?.toLocaleString()}</div>
                  )}
                  {check.subledger_total !== undefined && (
                    <div>Subledger Total: ${check.subledger_total?.toLocaleString()}</div>
                  )}
                  {check.gl_total !== undefined && (
                    <div>GL Control Total: ${check.gl_total?.toLocaleString()}</div>
                  )}
                  {check.difference !== undefined && (
                    <div className="font-semibold">Variance: ${check.difference?.toLocaleString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Environment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup Status */}
        <div className="card p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-600" />
            Backup Infrastructure Status
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Last Backup Archive:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{data?.backup.last_backup_file || "None"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Backup Status:</span>
              <span className="font-bold text-emerald-600">{data?.backup.last_backup_status}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Total System Archives:</span>
              <span className="font-bold">{data?.backup.total_backups_count}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Last Execution:</span>
              <span className="text-slate-600 dark:text-slate-400">
                {data?.backup.last_backup_date ? new Date(data.backup.last_backup_date).toLocaleString() : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Local PC & Storage */}
        <div className="card p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-600" />
            Local Server & Document Storage
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">API Status:</span>
              <span className="font-bold text-emerald-600">{data?.api_status}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Uploaded Documents:</span>
              <span className="font-bold">{data?.documents.count} files</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Upload Directory:</span>
              <span className="font-mono text-[10px] text-slate-600 truncate max-w-[220px]">
                {data?.documents.storage_path}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Disk Health:</span>
              <span className="font-bold text-emerald-600">{data?.disk_storage.status}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
