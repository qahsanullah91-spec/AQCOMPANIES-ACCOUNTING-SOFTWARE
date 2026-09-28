"use client";

import React, { useEffect, useState } from "react";
import {
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Database,
  Archive,
  Server,
  FileText,
  Play,
  Check,
  Eye,
  X,
  FileJson,
  ShieldAlert,
} from "lucide-react";
import { fetchApi, API_BASE } from "@/lib/api";

interface BackupRecord {
  id: number;
  backup_code: string;
  filename: string;
  backup_type: string;
  size_bytes: number;
  checksum_sha256: string;
  status: string;
  file_exists?: boolean;
  record_counts: Record<string, number>;
  created_by: string;
  created_at: string;
  verified_at?: string;
  notes?: string;
}

interface BackupStatus {
  has_backup: boolean;
  last_backup_time: string | null;
  last_backup_code: string | null;
  filename: string | null;
  size_bytes: number;
  status: string;
  verified: boolean;
  destination: string;
  secondary_destination?: string | null;
  hours_since_last_backup: number | null;
  attention_required: boolean;
  alert_message: string | null;
}

interface BackupPreview {
  has_manifest: boolean;
  manifest?: {
    backup_id: string;
    filename: string;
    backup_type: string;
    created_date: string;
    software_version: string;
    database_schema_version: string;
    record_counts: Record<string, number>;
    checksum_sha256: string;
    document_count: number;
    created_by: string;
    notes?: string;
  };
}

interface DryRunResult {
  status: "VALID" | "INVALID" | "REQUIRES_MIGRATION";
  can_restore: boolean;
  archive_tested: string;
  is_gl_balanced: boolean;
  gl_difference: number;
  current_schema_revision: string;
  backup_schema_revision: string;
  message: string;
  record_counts?: Record<string, number>;
  error?: string;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [statusData, setStatusData] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [dryRunning, setDryRunning] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [backupType, setBackupType] = useState("MANUAL");

  // Modals
  const [previewData, setPreviewData] = useState<BackupPreview | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [listRes, statusRes] = await Promise.all([
        fetchApi<BackupRecord[]>("/backup/list").catch(() => []),
        fetchApi<BackupStatus>("/backup/status").catch(() => null),
      ]);
      setBackups(listRes || []);
      setStatusData(statusRes);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetchApi<any>(`/backup/now?backup_type=${backupType}&user_name=Admin`, {
        method: "POST",
      });
      setSuccessMsg(
        `Enterprise Backup created & verified: ${res.filename} (${(res.size_bytes / (1024 * 1024)).toFixed(2)} MB)`
      );
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const handlePreview = async (filename: string) => {
    try {
      setErrorMsg("");
      setPreviewFilename(filename);
      const res = await fetchApi<BackupPreview>(`/backup/preview/${filename}`);
      setPreviewData(res);
    } catch (err: any) {
      setErrorMsg(`Failed to preview backup: ${err.message}`);
    }
  };

  const handleDryRun = async (filename: string) => {
    try {
      setDryRunning(filename);
      setErrorMsg("");
      setDryRunResult(null);
      const res = await fetchApi<DryRunResult>(`/backup/dry-run?backup_filename=${encodeURIComponent(filename)}`, {
        method: "POST",
      });
      setDryRunResult(res);
    } catch (err: any) {
      setErrorMsg(`Restore dry-run failed: ${err.message}`);
    } finally {
      setDryRunning(null);
    }
  };

  const handleExecuteRestore = async () => {
    if (!previewFilename) return;

    try {
      setRestoring(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetchApi<any>("/backup/restore-enterprise", {
        method: "POST",
        body: JSON.stringify({ filename: previewFilename, user_name: "Admin" }),
      });
      setSuccessMsg(
        `Database successfully restored! Automatic pre-restore rollback snapshot created: ${res.safety_snapshot}`
      );
      setShowRestoreConfirm(false);
      setPreviewData(null);
      setPreviewFilename(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to restore backup");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <HardDrive className="w-7 h-7 text-emerald-600" />
            Enterprise Backup & Disaster Recovery
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Database-Consistent Snapshots • Automatic Retention • Cryptographic Verification • Isolated Dry-Run Engine
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`${API_BASE}/backup/export-json`}
            download="AQ_COMPANIES_FULL_EXPORT.json"
            className="btn btn-secondary text-xs flex items-center gap-2"
          >
            <FileJson className="w-4 h-4 text-sky-600" />
            Export System JSON
          </a>
        </div>
      </div>

      {/* Section 10: Backup Attention Required Alert */}
      {statusData?.attention_required && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl flex items-start gap-3 shadow-sm">
          <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold tracking-tight">BACKUP ATTENTION REQUIRED</div>
            <div className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
              {statusData.alert_message ||
                "No verified backup has been created in the last 24 hours. Create a backup now to ensure disaster recovery readiness."}
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Section 9: Last Backup Status KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-emerald-600" />
            Last Backup Time
          </div>
          <div className="mt-2 text-base font-bold text-slate-900 dark:text-white">
            {statusData?.last_backup_time
              ? new Date(statusData.last_backup_time).toLocaleDateString() +
                " " +
                new Date(statusData.last_backup_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Never"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {statusData?.hours_since_last_backup !== null
              ? `${statusData?.hours_since_last_backup} hours ago`
              : "No backups on record"}
          </div>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Verification Status
          </div>
          <div className="mt-2 text-base font-bold flex items-center gap-2">
            {statusData?.verified ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="w-5 h-5" /> VERIFIED (YES)
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5" /> UNVERIFIED (NO)
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Status: <span className="font-semibold">{statusData?.status || "UNKNOWN"}</span>
          </div>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Database className="w-4 h-4 text-emerald-600" />
            Archive Size
          </div>
          <div className="mt-2 text-base font-bold text-slate-900 dark:text-white">
            {statusData?.size_bytes ? `${(statusData.size_bytes / (1024 * 1024)).toFixed(2)} MB` : "—"}
          </div>
          <div className="text-xs text-slate-500 mt-1 truncate" title={statusData?.filename || ""}>
            {statusData?.filename || "No archive"}
          </div>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Server className="w-4 h-4 text-emerald-600" />
            Storage Destination
          </div>
          <div className="mt-2 text-xs font-bold text-slate-900 dark:text-white truncate" title={statusData?.destination}>
            {statusData?.destination ? "Local: " + statusData.destination.split(/[\\/]/).pop() : "Local Backups"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Secondary: {statusData?.secondary_destination ? "Configured (Replicated)" : "None"}
          </div>
        </div>
      </div>

      {/* Backup Creation Card (Section 11) */}
      <div className="card p-6 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-emerald-950/20 border border-emerald-200 dark:border-emerald-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Create Enterprise Backup</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Online SQLite backup API snapshot • Flushes WAL • Archives supporting documents • Verifies SHA256
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={backupType}
              onChange={(e) => setBackupType(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold"
            >
              <option value="MANUAL">Manual Backup</option>
              <option value="DAILY">Daily Backup</option>
              <option value="WEEKLY">Weekly Archive</option>
              <option value="MONTHLY">Monthly Archive</option>
            </select>

            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="btn btn-primary py-2 px-5 text-xs font-bold flex items-center gap-2"
            >
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Packaging System...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" /> Create Backup Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Backups Table (Section 12) */}
      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Available System Backups ({backups.length})
          </h3>
          <button onClick={loadData} className="btn btn-secondary text-xs flex items-center gap-1.5 py-1 px-3">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3">Backup File</th>
                <th className="p-3">Type</th>
                <th className="p-3">Date</th>
                <th className="p-3">Size</th>
                <th className="p-3">Checksum</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading backup archives...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No verified backups found on local storage.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Archive className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-xs">{b.filename}</span>
                    </td>
                    <td className="p-3">
                      <span className="badge badge-neutral">{b.backup_type}</span>
                    </td>
                    <td className="p-3 text-slate-500">
                      {b.created_at ? new Date(b.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 font-mono font-medium">
                      {(b.size_bytes / (1024 * 1024)).toFixed(2)} MB
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-500 truncate max-w-[120px]" title={b.checksum_sha256}>
                      {b.checksum_sha256?.substring(0, 12)}...
                    </td>
                    <td className="p-3">
                      <span
                        className={`badge ${
                          b.status === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDryRun(b.filename)}
                          disabled={dryRunning === b.filename}
                          className="btn btn-secondary py-1 px-2.5 text-[11px] font-semibold flex items-center gap-1"
                          title="Validate in isolated sandbox"
                        >
                          {dryRunning === b.filename ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3 text-amber-600" />
                          )}
                          Dry-Run
                        </button>

                        <button
                          onClick={() => handlePreview(b.filename)}
                          className="btn btn-secondary py-1 px-2.5 text-[11px] font-semibold flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-sky-600" /> Inspect
                        </button>

                        <a
                          href={`${API_BASE}/backup/download/${b.filename}`}
                          download={b.filename}
                          className="btn btn-secondary py-1 px-2 text-[11px]"
                          title="Download ZIP Archive"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dry Run Result Modal (Section 15) */}
      {dryRunResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-amber-600" />
                Restore Dry-Run Results
              </h3>
              <button onClick={() => setDryRunResult(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div
                className={`p-3 rounded-xl border flex items-center gap-2 font-bold ${
                  dryRunResult.status === "VALID"
                    ? "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : dryRunResult.status === "REQUIRES_MIGRATION"
                    ? "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200"
                    : "bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200"
                }`}
              >
                {dryRunResult.status === "VALID" ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
                STATUS: {dryRunResult.status} — {dryRunResult.message}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-slate-500">GL Trial Balance:</span>
                  <div className="font-bold text-slate-900 dark:text-white mt-1">
                    {dryRunResult.is_gl_balanced ? "Balanced ($0.00 diff)" : `Difference: $${dryRunResult.gl_difference}`}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-slate-500">Database Schema:</span>
                  <div className="font-bold text-slate-900 dark:text-white mt-1">
                    Backup: {dryRunResult.backup_schema_revision} | Current: {dryRunResult.current_schema_revision}
                  </div>
                </div>
              </div>

              {dryRunResult.record_counts && (
                <div>
                  <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Restored Record Counts:</div>
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg font-mono text-[11px]">
                    <div>Invoices: {dryRunResult.record_counts.invoices ?? 0}</div>
                    <div>Customers: {dryRunResult.record_counts.customers ?? 0}</div>
                    <div>Suppliers: {dryRunResult.record_counts.suppliers ?? 0}</div>
                    <div>Shipments: {dryRunResult.record_counts.shipments ?? 0}</div>
                    <div>Journals: {dryRunResult.record_counts.journal_entries ?? 0}</div>
                    <div>Bank TX: {dryRunResult.record_counts.bank_transactions ?? 0}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={() => setDryRunResult(null)} className="btn btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect & Restore Modal (Sections 12, 13, 14) */}
      {previewData && previewFilename && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Backup Inspection & Restore
              </h3>
              <button
                onClick={() => {
                  setPreviewData(null);
                  setPreviewFilename(null);
                  setShowRestoreConfirm(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-1 font-mono text-[11px]">
                <div>File: <span className="font-bold text-slate-900 dark:text-white">{previewFilename}</span></div>
                {previewData.manifest && (
                  <>
                    <div>Software Version: {previewData.manifest.software_version}</div>
                    <div>Schema Version: {previewData.manifest.database_schema_version}</div>
                    <div>Created Date: {new Date(previewData.manifest.created_date).toLocaleString()}</div>
                    <div>SHA256: {previewData.manifest.checksum_sha256}</div>
                  </>
                )}
              </div>

              {!showRestoreConfirm ? (
                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={() => handleDryRun(previewFilename)}
                    className="btn btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-amber-600" />
                    Run Isolated Dry-Run First
                  </button>

                  <button
                    onClick={() => setShowRestoreConfirm(true)}
                    className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Proceed to Restore
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl space-y-3">
                  <div className="text-sm font-bold text-rose-900 dark:text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    CONFIRM LIVE RESTORE
                  </div>
                  <p className="text-xs text-rose-800 dark:text-rose-300">
                    Restoring will lock the system in Maintenance Mode, create an automatic PRE-RESTORE snapshot, and
                    restore database and documents from this archive.
                  </p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowRestoreConfirm(false)}
                      className="btn btn-secondary text-xs"
                      disabled={restoring}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExecuteRestore}
                      disabled={restoring}
                      className="btn bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-2"
                    >
                      {restoring ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Restoring & Checking Integrity...
                        </>
                      ) : (
                        "Yes, Restore Database Now"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
