"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sliders,
  DollarSign,
  UserCheck,
  Clock,
  Layers,
  FileText,
  ShieldAlert,
  Check,
  X,
  Eye,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface ApprovalItem {
  id: number;
  entity_type: string;
  entity_id: number;
  reference?: string;
  amount: number;
  currency: string;
  party_name?: string;
  account_name?: string;
  supporting_document?: string;
  requested_by: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  required_role: string;
  threshold_rule?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
}

interface ThresholdSettings {
  threshold_tier_1: number;
  threshold_tier_2: number;
  enforce_four_eyes: boolean;
}

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<"QUEUE" | "SETTINGS">("QUEUE");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [settings, setSettings] = useState<ThresholdSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Reject modal state
  const [rejectingItem, setRejectingItem] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Approve modal state
  const [approvingItem, setApprovingItem] = useState<ApprovalItem | null>(null);
  const [approveNotes, setApproveNotes] = useState("");

  const loadApprovals = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await fetchApi<ApprovalItem[]>(`/accounting/approvals?status=${statusFilter}`);
      setApprovals(data || []);

      const th = await fetchApi<ThresholdSettings>("/accounting/approvals/thresholds");
      setSettings(th);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load approval requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [statusFilter]);

  const handleApprove = async () => {
    if (!approvingItem) return;
    try {
      setActing(approvingItem.id);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetchApi<any>(`/accounting/approvals/${approvingItem.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          user_name: "Admin",
          user_role: "ADMIN",
          notes: approveNotes,
        }),
      });
      setSuccessMsg(`Transaction #${approvingItem.id} successfully approved by ${res.approved_by}!`);
      setApprovingItem(null);
      setApproveNotes("");
      loadApprovals();
    } catch (err: any) {
      setErrorMsg(err.message || "Approval failed");
    } finally {
      setActing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingItem) return;
    if (!rejectReason.trim()) {
      setErrorMsg("A rejection reason is mandatory.");
      return;
    }
    try {
      setActing(rejectingItem.id);
      setErrorMsg("");
      setSuccessMsg("");
      await fetchApi<any>(`/accounting/approvals/${rejectingItem.id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          user_name: "Admin",
          user_role: "ADMIN",
          reason: rejectReason,
        }),
      });
      setSuccessMsg(`Transaction #${rejectingItem.id} rejected.`);
      setRejectingItem(null);
      setRejectReason("");
      loadApprovals();
    } catch (err: any) {
      setErrorMsg(err.message || "Rejection failed");
    } finally {
      setActing(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      setErrorMsg("");
      setSuccessMsg("");
      await fetchApi("/accounting/approvals/thresholds", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSuccessMsg("Approval thresholds & Four-Eyes settings updated successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save settings");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <AccountingNav />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
            Financial Approval & Four-Eyes Control Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Payment Threshold Enforcement • Creator Cannot Approve Own Wire • Dual Sign-Off Audit Trail
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("QUEUE")}
            className={`btn text-xs font-semibold ${
              activeTab === "QUEUE" ? "btn-primary" : "btn-secondary"
            }`}
          >
            Approval Queue
          </button>
          <button
            onClick={() => setActiveTab("SETTINGS")}
            className={`btn text-xs font-semibold ${
              activeTab === "SETTINGS" ? "btn-primary" : "btn-secondary"
            }`}
          >
            <Sliders className="w-3.5 h-3.5 mr-1" /> Threshold Rules
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      {activeTab === "QUEUE" ? (
        <div className="space-y-4">
          {/* Status Tabs */}
          <div className="flex gap-2 text-xs font-semibold border-b border-slate-200 dark:border-slate-800 pb-2">
            {["PENDING", "APPROVED", "REJECTED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === st
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                {st} ({approvals.filter((a) => a.status === st).length || 0})
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Entity & Reference</th>
                    <th className="py-3 px-4">Party & Account</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Threshold Rule</th>
                    <th className="py-3 px-4">Submitted By</th>
                    <th className="py-3 px-4">Status & Sign-off</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {approvals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No transactions waiting in the {statusFilter.toLowerCase()} queue.
                      </td>
                    </tr>
                  ) : (
                    approvals.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-600" />
                            {req.entity_type} #{req.entity_id}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Ref: {req.reference || "N/A"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {req.party_name || "Unassigned"}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {req.account_name || "AQ Operating Bank"}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          ${req.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {req.currency}
                          {req.amount >= 25000 && (
                            <span className="block text-[9px] font-bold text-rose-600 uppercase tracking-wider">
                              Large Payment
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                            {req.required_role}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {req.threshold_rule}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-700 dark:text-slate-300">
                            {req.requested_by}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(req.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : req.status === "REJECTED"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {req.status}
                          </span>
                          {req.approved_by && (
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              By {req.approved_by}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {req.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => setApprovingItem(req)}
                                className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectingItem(req)}
                                className="px-2.5 py-1 text-xs font-bold rounded bg-rose-600 hover:bg-rose-700 text-white"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Settings Tab */
        <div className="card max-w-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Configurable Approval Thresholds & Controls
          </h3>

          {settings && (
            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Tier 1 Limit (Below this, Accountant posts directly):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    value={settings.threshold_tier_1}
                    onChange={(e) =>
                      setSettings({ ...settings, threshold_tier_1: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Tier 2 Limit (Above this, Senior/Super Admin approval required):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    value={settings.threshold_tier_2}
                    onChange={(e) =>
                      setSettings({ ...settings, threshold_tier_2: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enforce_four_eyes}
                    onChange={(e) => setSettings({ ...settings, enforce_four_eyes: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  Enforce Four-Eyes Control Policy (Section 7)
                </label>
                <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                  When enabled, the user who created the payment or journal entry cannot approve their own transaction.
                  A secondary authorized user must provide sign-off.
                </p>
              </div>

              <button type="submit" className="btn btn-primary w-full py-2.5 text-xs font-bold">
                Save Approval Policies
              </button>
            </form>
          )}
        </div>
      )}

      {/* Approve Modal */}
      {approvingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Approve Transaction #{approvingItem.id}
            </h3>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1 font-mono">
              <div>Amount: ${approvingItem.amount.toLocaleString()} {approvingItem.currency}</div>
              <div>Party: {approvingItem.party_name}</div>
              <div>Submitted By: {approvingItem.requested_by}</div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Approval Notes (Optional):</label>
              <textarea
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="Verified against commercial invoice / wire instruction..."
                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setApprovingItem(null)} className="btn btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={acting === approvingItem.id}
                className="btn btn-primary text-xs bg-emerald-600 hover:bg-emerald-700"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Reject Transaction #{rejectingItem.id}
            </h3>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1 font-mono">
              <div>Amount: ${rejectingItem.amount.toLocaleString()} {rejectingItem.currency}</div>
              <div>Party: {rejectingItem.party_name}</div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Rejection Reason (Mandatory):
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejecting wire disbursement..."
                className="w-full p-2.5 border border-rose-300 dark:border-rose-800 rounded-lg text-xs"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRejectingItem(null)} className="btn btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={acting === rejectingItem.id}
                className="btn btn-primary text-xs bg-rose-600 hover:bg-rose-700 border-rose-700"
              >
                Reject Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
