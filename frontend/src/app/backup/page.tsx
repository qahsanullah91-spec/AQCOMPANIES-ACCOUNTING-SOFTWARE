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
} from "lucide-react";
import { fetchApi, API_BASE } from "@/lib/api";

interface BackupItem {
  filename: string;
  size_bytes: number;
  modified: string;
}

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadBackups = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<BackupItem[]>("/backup/list");
      setBackups(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetchApi<any>("/backup/now", { method: "POST" });
      setSuccessMsg(`Backup created successfully: ${res.backup_name}`);
      loadBackups();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Are you sure you want to restore the database from this ZIP file? A safety backup will be made automatically before restoring.")) {
      return;
    }

    try {
      setRestoring(true);
      setErrorMsg("");
      setSuccessMsg("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/backup/restore`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Restore failed: ${res.statusText}`);
      }

      const resData = await res.json();
      setSuccessMsg(
        `Database successfully restored! (Safety snapshot created: ${resData.safety_backup})`
      );
      loadBackups();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to restore backup");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <HardDrive className="w-7 h-7 text-emerald-600" />
          Backup & Disaster Recovery
        </h1>
        <p className="text-sm text-slate-500">
          1-Click Local ZIP Backups • Database & Document Archives • Safe Rollback Protection
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 text-sm font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-700" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          {errorMsg}
        </div>
      )}

      {/* Backup Action Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Backup */}
        <div className="card p-6 bg-gradient-to-br from-white to-emerald-50/50 border border-emerald-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Create Full System Backup</h2>
              <p className="text-xs text-slate-500">
                Packs SQLite WAL database, uploads, and ledgers into a compressed ZIP
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Every backup is timestamped and can be safely moved to a USB drive, external hard disk, or secondary PC for
            100% offline security.
          </p>

          <button
            onClick={handleCreateBackup}
            disabled={creating}
            className="btn btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Packaging System...
              </>
            ) : (
              <>
                <HardDrive className="w-4 h-4" /> Create Backup Now (ZIP)
              </>
            )}
          </button>
        </div>

        {/* Restore Backup */}
        <div className="card p-6 bg-gradient-to-br from-white to-indigo-50/50 border border-indigo-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Safe Restore from ZIP</h2>
              <p className="text-xs text-slate-500">
                Restore database with automatic safety pre-restore snapshot
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Before applying any restore, the system automatically saves a copy of your existing database
            (<code>pre_restore_timestamp.db</code>) so no data is ever lost.
          </p>

          <label className="btn btn-secondary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            {restoring ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Restoring Database...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" /> Select Backup ZIP to Restore
                <input
                  type="file"
                  accept=".zip"
                  className="hidden"
                  disabled={restoring}
                  onChange={handleRestoreUpload}
                />
              </>
            )}
          </label>
        </div>
      </div>

      {/* Backups Table */}
      <div className="card overflow-hidden bg-white shadow-sm space-y-3">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Available Local Backups</h3>
            <p className="text-xs text-slate-500">Stored locally in your software installation directory</p>
          </div>
          <button onClick={loadBackups} className="btn btn-secondary text-xs flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Backup Filename</th>
                <th>Created Timestamp</th>
                <th>File Size</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-400">
                    Loading backups list...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-400">
                    No backup files found. Click &quot;Create Backup Now&quot; above to generate your first snapshot.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-slate-50 transition-colors">
                    <td className="font-mono font-bold text-slate-900 text-xs flex items-center gap-2">
                      <Archive className="w-4 h-4 text-emerald-600" />
                      {b.filename}
                    </td>
                    <td className="text-xs text-slate-500">
                      {new Date(b.modified).toLocaleString()}
                    </td>
                    <td className="text-xs font-mono font-medium text-slate-700">
                      {(b.size_bytes / (1024 * 1024)).toFixed(2)} MB
                    </td>
                    <td className="text-center">
                      <a
                        href={`${API_BASE}/backup/download/${b.filename}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary py-1 px-3 text-xs inline-flex items-center gap-1 font-semibold text-emerald-700"
                      >
                        <Download className="w-3.5 h-3.5" /> Download ZIP
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deployment & Offline Architecture Info */}
      <div className="card p-6 bg-slate-50 border border-slate-200 text-xs space-y-3">
        <h4 className="font-bold text-slate-900 flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-600" />
          Enterprise Local & Network Deployment Architecture
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-600">
          <div className="bg-white p-3 rounded-lg border">
            <span className="font-bold text-slate-800 block mb-1">Single PC Mode:</span>
            Runs entirely on your local Windows PC without needing an internet connection. SQLite WAL mode ensures high
            speed and crash safety.
          </div>
          <div className="bg-white p-3 rounded-lg border">
            <span className="font-bold text-slate-800 block mb-1">Local Network (LAN) Mode:</span>
            Run the backend on your main office PC (e.g. <code>http://192.168.1.100:8000</code>). Staff in the Kabul or
            Delhi office can access the system simultaneously via web browser.
          </div>
          <div className="bg-white p-3 rounded-lg border">
            <span className="font-bold text-slate-800 block mb-1">Disaster Recovery:</span>
            Backups contain the complete SQLite database and all scanned PDF documents. Restoring to a new computer takes
            less than 1 minute.
          </div>
        </div>
      </div>
    </div>
  );
}
