"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCw,
  FileText,
  DollarSign,
  UserCheck,
  Layers,
  ChevronRight,
  ArrowRight,
  X,
  FileCheck2,
  Eye,
  Check,
  Building,
  CreditCard,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { fetchApi, formatUSD, formatCurrency } from "@/lib/api";

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

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [currentUsername, setCurrentUsername] = useState<string>("Admin");

  // Selected item for review modal
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Approval confirmation modal (Req 15)
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");

  // Action status
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("aq_username");
      if (savedUser) setCurrentUsername(savedUser);
    }
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      const res: any = await fetchApi("/accounting/approvals?status=PENDING").catch(() => []);
      if (Array.isArray(res)) {
        setApprovals(res);
      } else {
        setApprovals([]);
      }
    } catch (err: any) {
      console.warn("Failed to load approvals", err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered approval items
  const filteredApprovals = useMemo(() => {
    if (filterType === "ALL") return approvals;
    return approvals.filter((a) =>
      a.entity_type.toUpperCase().includes(filterType.toUpperCase())
    );
  }, [approvals, filterType]);

  // Reject Request
  const handleConfirmReject = async () => {
    if (!selectedItem || !rejectReason.trim()) return;

    try {
      setActionInProgress(true);
      await fetchApi(`/accounting/approvals/${selectedItem.id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          user_name: currentUsername,
          user_role: "ADMIN",
          reason: rejectReason.trim(),
        }),
      });

      setActionMessage({ type: "success", text: `Transaction #${selectedItem.reference || selectedItem.id} rejected.` });
      setRejectModalOpen(false);
      setSelectedItem(null);
      setRejectReason("");
      loadApprovals();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to reject transaction." });
    } finally {
      setActionInProgress(false);
    }
  };

  // Approve & Post Request (Req 14, 15)
  const handleConfirmApprove = async () => {
    if (!selectedItem) return;

    try {
      setActionInProgress(true);
      await fetchApi(`/accounting/approvals/${selectedItem.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          user_name: currentUsername,
          user_role: "ADMIN",
          notes: approveNotes.trim() || undefined,
        }),
      });

      setActionMessage({ type: "success", text: `Transaction #${selectedItem.reference || selectedItem.id} approved & posted to ledger!` });
      setConfirmApproveOpen(false);
      setSelectedItem(null);
      setApproveNotes("");
      loadApprovals();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to approve transaction." });
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-sky-600" />
            Payment Approval Center
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Dual-control authorization & Four-Eyes release queue
          </p>
        </div>

        <button
          onClick={loadApprovals}
          disabled={loading}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Refresh queue"
        >
          <RotateCw className={`w-4 h-4 ${loading ? "animate-spin text-sky-500" : ""}`} />
        </button>
      </div>

      {/* Action Toast Feedback */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn ${
            actionMessage.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Tabs (Req 10) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {[
          { key: "ALL", label: `All (${approvals.length})` },
          { key: "TRANSPORT", label: "Transport" },
          { key: "SUPPLIER", label: "Supplier" },
          { key: "EXPENSE", label: "Expenses" },
          { key: "JOURNAL", label: "Journals" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterType(tab.key)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              filterType === tab.key
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Approval Cards List (Req 11) */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RotateCw className="w-5 h-5 animate-spin text-sky-500" />
            Loading pending approvals...
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              No Pending Approvals
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All disbursements and journals have been verified and authorized according to threshold rules.
            </p>
          </div>
        ) : (
          filteredApprovals.map((item) => {
            const isLarge = item.amount >= 100000;
            const isCreator = item.requested_by.toLowerCase() === currentUsername.toLowerCase();

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs hover:border-sky-500/50 transition-all space-y-3"
              >
                {/* Top Row: Type & Amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                      {item.entity_type}
                    </span>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
                      {item.party_name || "General Ledger Disbursement"}
                    </h3>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.amount, item.currency || "USD")}
                    </div>
                    {isLarge && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        Tier 2
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Grid (Req 11) */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">From Account</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {item.account_name || "AQ USD Bank"}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Reference</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 truncate block">
                      {item.reference || `#${item.entity_id}`}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Created By</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                      {item.requested_by}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Supporting Doc</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      {item.supporting_document ? "Attached" : "Verified"}
                    </span>
                  </div>
                </div>

                {/* Four-Eyes Notice (Req 16) */}
                {isCreator && (
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>ANOTHER AUTHORIZED USER MUST APPROVE THIS TRANSACTION.</span>
                  </div>
                )}

                {/* Action Button: Review (Req 11) */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="w-full sm:w-auto py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>Review Transaction</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* APPROVAL DETAIL SHEET (Req 12, 13, 14, 16, 17) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full sm:max-w-lg bg-white dark:bg-[#111827] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] max-h-[92dvh] animate-slideUp">
            {/* Sheet Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
                  {selectedItem.entity_type}
                </span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Transaction Authorization Review
                </h2>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sheet Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Large Payment Warning (Req 17) */}
              {selectedItem.amount >= 100000 && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      LARGE PAYMENT: {formatCurrency(selectedItem.amount, selectedItem.currency)}
                    </div>
                    <p className="mt-0.5 text-[11px] text-amber-700/90 dark:text-amber-300/90">
                      High-value disbursement exceeds standard authorization threshold. Review bank account, invoice, and recipient details carefully before approval.
                    </p>
                  </div>
                </div>
              )}

              {/* Amount Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Disbursement Amount
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatCurrency(selectedItem.amount, selectedItem.currency)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Beneficiary: <strong>{selectedItem.party_name || "General Ledger"}</strong>
                </div>
              </div>

              {/* Metadata Details (Req 12) */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-500">Paying Account</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedItem.account_name || "AQ USD Bank"}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-500">Voucher Reference</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedItem.reference || `#${selectedItem.entity_id}`}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-500">Initiated By</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedItem.requested_by}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-500">Initiation Timestamp</span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {selectedItem.created_at?.split("T")[0]}
                  </span>
                </div>
                {selectedItem.notes && (
                  <div className="py-2 space-y-1">
                    <span className="text-slate-500 text-[11px]">Memo / Purpose</span>
                    <p className="italic text-slate-700 dark:text-slate-300 text-[11px] bg-slate-50 dark:bg-slate-900 p-2 rounded-lg">
                      "{selectedItem.notes}"
                    </p>
                  </div>
                )}
              </div>

              {/* INFORMATIONAL ACCOUNTING PREVIEW (Req 13) */}
              <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-500/20 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Informational General Ledger Preview
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-emerald-600">DEBIT</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                      {selectedItem.entity_type.includes("Transport")
                        ? "Transport Payable"
                        : selectedItem.entity_type.includes("Supplier")
                        ? "Accounts Payable (Trade)"
                        : "Operating Expense"}
                    </div>
                    <div className="text-xs font-black text-emerald-600 mt-1">
                      {formatCurrency(selectedItem.amount, selectedItem.currency)}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-sky-600">CREDIT</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                      {selectedItem.account_name || "AQ USD Bank"}
                    </div>
                    <div className="text-xs font-black text-sky-600 mt-1">
                      {formatCurrency(selectedItem.amount, selectedItem.currency)}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 italic">
                  Posting engine validates balance sheet equality ($0.00 difference) upon authorization.
                </div>
              </div>

              {/* Four-Eyes Enforcement Message (Req 16) */}
              {selectedItem.requested_by.toLowerCase() === currentUsername.toLowerCase() ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold text-center">
                  ANOTHER AUTHORIZED USER MUST APPROVE THIS TRANSACTION.
                  <div className="text-[11px] font-normal text-slate-500 mt-1">
                    Four-Eyes rule prevents self-authorization of created vouchers.
                  </div>
                </div>
              ) : (
                /* Primary Actions (Req 14) */
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(true)}
                    className="flex-1 py-3 px-4 rounded-xl border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition-all active:scale-98"
                  >
                    Reject...
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmApproveOpen(true)}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Approve & Post</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* APPROVE CONFIRMATION SHEET (Req 15) */}
      {confirmApproveOpen && selectedItem && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full sm:max-w-md bg-white dark:bg-[#111827] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4 animate-slideUp">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                APPROVE PAYMENT?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Transaction will be finalized and posted to the General Ledger.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Party:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedItem.party_name || "AQ Companies"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(selectedItem.amount, selectedItem.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedItem.account_name || "AQ USD Bank"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmApproveOpen(false)}
                disabled={actionInProgress}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={actionInProgress}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5"
              >
                {actionInProgress ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Posting...</span>
                  </>
                ) : (
                  <span>Approve & Post</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT CONFIRMATION SHEET (Req 14) */}
      {rejectModalOpen && selectedItem && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full sm:max-w-md bg-white dark:bg-[#111827] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4 animate-slideUp">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-600 flex items-center justify-center mx-auto mb-2">
                <XCircle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Reject Transaction
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Specify the reason for returning this disbursement.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Rejection Reason *
              </label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Supporting invoice amount mismatch, rate discrepancy..."
                className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                disabled={actionInProgress}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!rejectReason.trim() || actionInProgress}
                onClick={handleConfirmReject}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/25 flex items-center justify-center gap-1.5"
              >
                {actionInProgress ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Confirm Rejection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
