"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Clock,
  UserCheck,
  FileText,
  RefreshCw,
  Eye,
  Check,
  X,
  FileCheck,
  Info,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface AccountingPeriod {
  id: number;
  period_name: string;
  start_date: string;
  end_date: string;
  status: "OPEN" | "CLOSED" | "LOCKED" | "REOPENED";
  closed_by: string | null;
  closed_at: string | null;
  notes: string | null;
}

interface ChecklistItem {
  item: string;
  passed: boolean;
  details: string;
  blocking: boolean;
}

interface ReadinessData {
  period_id: number;
  period_name: string;
  can_close: boolean;
  checklist: ChecklistItem[];
  pending_purchase_costs_count: number;
  warning: string | null;
}

interface SnapshotItem {
  id: number;
  report_type: string;
  as_of_date: string;
  generated_at: string;
  generated_by: string;
  checksum: string;
  data: any;
  notes: string | null;
}

export default function PeriodClosingPage() {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    period: AccountingPeriod | null;
    action: "close" | "lock" | "reopen";
  }>({ open: false, period: null, action: "close" });

  const [readinessModal, setReadinessModal] = useState<{
    open: boolean;
    period: AccountingPeriod | null;
    data: ReadinessData | null;
    loading: boolean;
  }>({ open: false, period: null, data: null, loading: false });

  const [snapshotModal, setSnapshotModal] = useState<{
    open: boolean;
    period: AccountingPeriod | null;
    snapshots: SnapshotItem[];
    loading: boolean;
  }>({ open: false, period: null, snapshots: [], loading: false });

  const [userName, setUserName] = useState("Admin (Accountant)");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPeriods = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<AccountingPeriod[]>("/accounting/periods");
      setPeriods(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriods();
  }, []);

  const openAction = (period: AccountingPeriod, action: "close" | "lock" | "reopen") => {
    setActionModal({ open: true, period, action });
    setReason("");
    setNotes("");
  };

  const verifyReadiness = async (period: AccountingPeriod) => {
    setReadinessModal({ open: true, period, data: null, loading: true });
    try {
      const res = await fetchApi<ReadinessData>(`/accounting/periods/${period.id}/readiness`);
      setReadinessModal({ open: true, period, data: res, loading: false });
    } catch (err: any) {
      alert(err.message || "Failed to verify period readiness.");
      setReadinessModal({ open: false, period: null, data: null, loading: false });
    }
  };

  const viewSnapshots = async (period: AccountingPeriod) => {
    setSnapshotModal({ open: true, period, snapshots: [], loading: true });
    try {
      const res = await fetchApi<SnapshotItem[]>(`/accounting/periods/${period.id}/snapshots`);
      setSnapshotModal({ open: true, period, snapshots: res || [], loading: false });
    } catch (err: any) {
      alert(err.message || "Failed to load period snapshots.");
      setSnapshotModal({ open: false, period: null, snapshots: [], loading: false });
    }
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal.period) return;

    try {
      setSubmitting(true);
      if (actionModal.action === "reopen") {
        if (!reason || reason.trim().length < 5) {
          alert("A formal reason (minimum 5 characters) is required to reopen an accounting period.");
          return;
        }
        await fetchApi(`/accounting/periods/${actionModal.period.id}/reopen`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_name: userName,
            reason: reason,
          }),
        });
      } else {
        await fetchApi(`/accounting/periods/${actionModal.period.id}/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: actionModal.action === "lock" ? "LOCKED" : "CLOSED",
            user_name: userName,
            notes: notes || `Period closed after verification checklist passed.`,
          }),
        });
      }

      setActionModal({ open: false, period: null, action: "close" });
      loadPeriods();
    } catch (err: any) {
      alert(err.message || "Failed to update accounting period");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
      <AccountingNav />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link href="/accounting/reports" className="hover:text-sky-600 flex items-center space-x-1">
              <span>Financial Report Center</span>
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Period Closing</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting Period Management & Month-End Closing</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Immutable snapshots with SHA256 checksums, pre-closing checklists & audit trail logging.
          </p>
        </div>

        <button
          onClick={loadPeriods}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Periods</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Periods</span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{periods.length}</div>
          <span className="text-xs text-slate-400">Fiscal Year 2026 Monthly</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Open Active Periods</span>
          <div className="text-xl font-bold text-emerald-600 mt-1">
            {periods.filter((p) => p.status === "OPEN" || p.status === "REOPENED").length}
          </div>
          <span className="text-xs text-slate-400">Ready for daily postings</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Closed Periods</span>
          <div className="text-xl font-bold text-amber-600 mt-1">
            {periods.filter((p) => p.status === "CLOSED").length}
          </div>
          <span className="text-xs text-slate-400">Snapshots captured with SHA256</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Permanently Locked</span>
          <div className="text-xl font-bold text-purple-600 mt-1">
            {periods.filter((p) => p.status === "LOCKED").length}
          </div>
          <span className="text-xs text-slate-400">Audited & Finalized</span>
        </div>
      </div>

      {/* Periods Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden my-6">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Period Name</th>
              <th className="py-3 px-4">Start Date</th>
              <th className="py-3 px-4">End Date</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Closed By / Date</th>
              <th className="py-3 px-4">Notes / Reopen Reason</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {periods.map((p) => {
              const isOpen = p.status === "OPEN" || p.status === "REOPENED";
              const isClosed = p.status === "CLOSED";
              const isLocked = p.status === "LOCKED";

              return (
                <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-sky-600" />
                    <span>{p.period_name}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">{p.start_date}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{p.end_date}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        p.status === "OPEN"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : p.status === "REOPENED"
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                          : p.status === "CLOSED"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {p.closed_by ? (
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{p.closed_by}</span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {p.closed_at ? new Date(p.closed_at).toLocaleDateString() : ""}
                        </span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{p.notes || "-"}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      {/* Verify Checklist (Open periods) */}
                      {isOpen && (
                        <button
                          onClick={() => verifyReadiness(p)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors"
                        >
                          Verify Checklist
                        </button>
                      )}

                      {/* Close button */}
                      {isOpen && (
                        <button
                          onClick={() => openAction(p, "close")}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                        >
                          Close Period
                        </button>
                      )}

                      {/* Snapshots button */}
                      {isClosed && (
                        <button
                          onClick={() => viewSnapshots(p)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Snapshots</span>
                        </button>
                      )}

                      {/* Reopen button */}
                      {isClosed && (
                        <button
                          onClick={() => openAction(p, "reopen")}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pre-close Verification Checklist Modal */}
      {readinessModal.open && readinessModal.period && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Pre-Close Verification Checklist: {readinessModal.period.period_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Section 16 mandatory audit requirements before period can be closed.
                </p>
              </div>
              <button
                onClick={() => setReadinessModal({ open: false, period: null, data: null, loading: false })}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {readinessModal.loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
                <span>Running diagnostic checks on General Ledger and subledgers...</span>
              </div>
            ) : readinessModal.data ? (
              <div className="space-y-3">
                <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                  readinessModal.data.can_close
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-200"
                    : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-800 dark:text-rose-200"
                }`}>
                  <span>{readinessModal.data.can_close ? "ALL BLOCKING REQUIREMENTS PASSED — READY TO CLOSE" : "BLOCKING REQUIREMENTS FAILED"}</span>
                  <span className="font-mono">{readinessModal.data.can_close ? "PASSED" : "BLOCKED"}</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {readinessModal.data.checklist.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-start justify-between">
                      <div className="flex items-start space-x-2">
                        {item.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${item.blocking ? "text-rose-600" : "text-amber-500"}`} />
                        )}
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{item.item}</span>
                          <span className="text-[11px] text-slate-500 block">{item.details}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        item.passed
                          ? "bg-emerald-100 text-emerald-800"
                          : item.blocking
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {item.passed ? "OK" : item.blocking ? "BLOCKING" : "WARNING"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                  <button
                    onClick={() => setReadinessModal({ open: false, period: null, data: null, loading: false })}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    Close
                  </button>
                  {readinessModal.data.can_close && (
                    <button
                      onClick={() => {
                        const p = readinessModal.period;
                        setReadinessModal({ open: false, period: null, data: null, loading: false });
                        if (p) openAction(p, "close");
                      }}
                      className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white"
                    >
                      Proceed to Close Period
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Snapshot Viewer Modal */}
      {snapshotModal.open && snapshotModal.period && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Immutable Financial Snapshots: {snapshotModal.period.period_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Cryptographically secured with SHA256 checksums at time of closing.
                </p>
              </div>
              <button
                onClick={() => setSnapshotModal({ open: false, period: null, snapshots: [], loading: false })}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {snapshotModal.snapshots.map((s) => (
              <div key={s.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{s.report_type}</span>
                  <span className="text-[11px] font-mono text-slate-400">As of {s.as_of_date}</span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 break-all bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-sky-600 mr-2">SHA256:</span>
                  {s.checksum}
                </div>
                <div className="text-xs text-slate-500 flex justify-between">
                  <span>Generated By: {s.generated_by}</span>
                  <span>Captured: {new Date(s.generated_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Modal (Close / Reopen) */}
      {actionModal.open && actionModal.period && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className={`p-2.5 rounded-xl ${
                actionModal.action === "reopen"
                  ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-600"
              }`}>
                {actionModal.action === "reopen" ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 capitalize">
                  {actionModal.action} Period: {actionModal.period.period_name}
                </h3>
                <p className="text-xs text-slate-500">
                  {actionModal.period.start_date} to {actionModal.period.end_date}
                </p>
              </div>
            </div>

            <form onSubmit={handleExecuteAction} className="space-y-4 pt-2 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Authorized User:
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              {actionModal.action === "reopen" ? (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Formal Business Reason (Mandatory & Audited):
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide explicit reason for reopening a closed period (minimum 5 characters)..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Closing Notes:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Month-end closing completed with all checks balanced."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal({ open: false, period: null, action: "close" })}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg text-white ${
                    actionModal.action === "reopen" ? "bg-sky-600 hover:bg-sky-500" : "bg-amber-600 hover:bg-amber-500"
                  }`}
                >
                  {submitting ? "Processing..." : `Confirm ${actionModal.action.toUpperCase()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
