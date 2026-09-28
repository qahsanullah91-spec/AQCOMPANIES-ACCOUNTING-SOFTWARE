"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Split,
  FileQuestion,
  Landmark,
  ShieldAlert,
  RotateCw,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";

interface WorkQueueSummary {
  unallocatedReceiptsCount: number;
  unallocatedReceiptsAmount: number;
  unreconciledBankLinesCount: number;
  missingPurchaseCostsCount: number;
  pendingApprovalsCount: number;
}

export function MobileWorkQueue() {
  const [summary, setSummary] = useState<WorkQueueSummary>({
    unallocatedReceiptsCount: 0,
    unallocatedReceiptsAmount: 0,
    unreconciledBankLinesCount: 0,
    missingPurchaseCostsCount: 0,
    pendingApprovalsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadWorkQueue = async () => {
    try {
      setLoading(true);
      // Fetch dashboard KPIs for pending purchases
      const kpisRes: any = await fetchApi("/dashboard/kpis?filter=this_year").catch(() => null);

      // Fetch unallocated receipts
      const unallocatedRes: any = await fetchApi("/accounting/unallocated-receipts").catch(() => null);

      // Fetch bank summary for unreconciled count
      const bankRes: any = await fetchApi("/accounting/banks/summary").catch(() => null);

      // Fetch approvals count
      const approvalsRes: any = await fetchApi("/accounting/approvals/pending").catch(() => null);

      const pendingPurchases = kpisRes?.kpis?.pending_purchases_count || 0;
      const unallocCount = Array.isArray(unallocatedRes) ? unallocatedRes.length : (unallocatedRes?.count || 0);
      const unallocAmount = Array.isArray(unallocatedRes)
        ? unallocatedRes.reduce((sum: number, item: any) => sum + (Number(item.unallocated_amount || item.amount) || 0), 0)
        : (unallocatedRes?.total_unallocated || 0);
      const unreconciledCount = bankRes?.reconciliation_summary?.unreconciled || bankRes?.unreconciled_count || 0;
      const approvalsCount = Array.isArray(approvalsRes) ? approvalsRes.length : (approvalsRes?.count || 0);

      setSummary({
        unallocatedReceiptsCount: unallocCount,
        unallocatedReceiptsAmount: unallocAmount,
        unreconciledBankLinesCount: unreconciledCount,
        missingPurchaseCostsCount: pendingPurchases,
        pendingApprovalsCount: approvalsCount,
      });
    } catch (err) {
      console.warn("Work queue load non-fatal error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkQueue();

    // Listen for stale data refresh event (Req 56)
    const handleStaleRefresh = () => loadWorkQueue();
    window.addEventListener("aq_stale_data_refresh", handleStaleRefresh);
    return () => window.removeEventListener("aq_stale_data_refresh", handleStaleRefresh);
  }, []);

  const totalActionItems =
    summary.unallocatedReceiptsCount +
    summary.unreconciledBankLinesCount +
    summary.missingPurchaseCostsCount +
    summary.pendingApprovalsCount;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Work Queue — Needs Attention
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {totalActionItems > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              {totalActionItems} PENDING
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              UP TO DATE
            </span>
          )}
          <button
            onClick={loadWorkQueue}
            disabled={loading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh queue"
            aria-label="Refresh queue"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-sky-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* Action Items List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
        {/* 1. Unallocated Receipts (Req 44) */}
        <Link
          href="/accounting/allocation"
          className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-800 group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                summary.unallocatedReceiptsCount > 0
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}
            >
              <Split className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                Unallocated Receipts
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {summary.unallocatedReceiptsCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {summary.unallocatedReceiptsCount} customer receipts ({formatUSD(summary.unallocatedReceiptsAmount)})
                  </span>
                ) : (
                  <span>All customer payments allocated to invoices</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {summary.unallocatedReceiptsCount > 0 ? (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                {summary.unallocatedReceiptsCount}
              </span>
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* 2. Unreconciled Bank Lines (Req 44) */}
        <Link
          href="/banking/reconciliation"
          className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-800 group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                summary.unreconciledBankLinesCount > 0
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}
            >
              <Landmark className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                Unreconciled Bank Transactions
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {summary.unreconciledBankLinesCount > 0 ? (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    {summary.unreconciledBankLinesCount} bank statement lines awaiting ledger match
                  </span>
                ) : (
                  <span>Bank statements match general ledger</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {summary.unreconciledBankLinesCount > 0 ? (
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20">
                {summary.unreconciledBankLinesCount}
              </span>
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* 3. Missing Afghan Purchase Costs (Req 44) */}
        <Link
          href="/purchases"
          className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-800 group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                summary.missingPurchaseCostsCount > 0
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}
            >
              <FileQuestion className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                Missing Afghan Purchase Costs
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {summary.missingPurchaseCostsCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {summary.missingPurchaseCostsCount} shipments without Afghan supplier purchase cost
                  </span>
                ) : (
                  <span>All shipments have confirmed purchase costs</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {summary.missingPurchaseCostsCount > 0 ? (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                {summary.missingPurchaseCostsCount}
              </span>
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* 4. Payments Waiting Approval (Req 44) */}
        <Link
          href="/accounting/approvals"
          className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-800 group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                summary.pendingApprovalsCount > 0
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                Payments Waiting Approval
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {summary.pendingApprovalsCount > 0 ? (
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">
                    {summary.pendingApprovalsCount} payments pending review / dual-control release
                  </span>
                ) : (
                  <span>No payments waiting authorization</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {summary.pendingApprovalsCount > 0 ? (
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                {summary.pendingApprovalsCount}
              </span>
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
}
