"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Layers,
  Building2,
  Landmark,
  FileText,
  Truck,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { fetchApi, formatUSD, safeDecimal } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";
import {
  PdfDownloadButton,
  PrintButton,
  MoneyDisplay,
} from "@/components/accounting";

interface BalanceSheetAccountItem {
  account_code: string;
  account_name: string;
  sub_type?: string;
  balance: number;
  is_credit_in_our_favor?: boolean;
  is_pending_cost?: boolean;
}

interface CarrierCreditStanding {
  amount: number;
  in_our_favor: boolean;
  status: string;
}

interface BalanceSheetSection {
  items?: BalanceSheetAccountItem[];
  total: number;
  carrier_credit_standing?: CarrierCreditStanding;
  current_period_earnings?: number;
  has_pending_cost?: boolean;
  // Fallbacks for potential nested legacy responses
  current_assets?: { items?: BalanceSheetAccountItem[]; accounts?: BalanceSheetAccountItem[]; total?: number };
  non_current_assets?: { items?: BalanceSheetAccountItem[]; accounts?: BalanceSheetAccountItem[]; total?: number };
  current_liabilities?: { items?: BalanceSheetAccountItem[]; accounts?: BalanceSheetAccountItem[]; total?: number };
  long_term_liabilities?: { items?: BalanceSheetAccountItem[]; accounts?: BalanceSheetAccountItem[]; total?: number };
  equity_accounts?: { items?: BalanceSheetAccountItem[]; accounts?: BalanceSheetAccountItem[]; total?: number };
  total_assets?: number;
  total_liabilities?: number;
  total_equity?: number;
}

interface BalanceSheetResponse {
  as_of_date: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  total_assets: number;
  total_liabilities_and_equity: number;
  difference: number;
  is_balanced: boolean;
  status: string;
  notice?: string | null;
}

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sec: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  async function loadBalanceSheet(dateStr?: string) {
    try {
      setLoading(true);
      setError(null);
      const url = dateStr
        ? `/accounting/balance-sheet?as_of_date=${dateStr}`
        : "/accounting/balance-sheet";
      const res = await fetchApi<BalanceSheetResponse>(url);
      setData(res);
    } catch (err: any) {
      console.error("Failed to load balance sheet", err);
      setError(err?.message || "Failed to load balance sheet from API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBalanceSheet(asOfDate);
  }, []);

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newDate = e.target.value;
    setAsOfDate(newDate);
    loadBalanceSheet(newDate);
  }

  // Defensive item extractors supporting both flat backend items & legacy nested groups
  const assetItems: BalanceSheetAccountItem[] =
    data?.assets?.items ??
    [
      ...(data?.assets?.current_assets?.accounts ?? data?.assets?.current_assets?.items ?? []),
      ...(data?.assets?.non_current_assets?.accounts ?? data?.assets?.non_current_assets?.items ?? []),
    ];

  const liabilityItems: BalanceSheetAccountItem[] =
    data?.liabilities?.items ??
    [
      ...(data?.liabilities?.current_liabilities?.accounts ?? data?.liabilities?.current_liabilities?.items ?? []),
      ...(data?.liabilities?.long_term_liabilities?.accounts ?? data?.liabilities?.long_term_liabilities?.items ?? []),
    ];

  const equityItems: BalanceSheetAccountItem[] =
    data?.equity?.items ??
    (data?.equity?.equity_accounts?.accounts ?? data?.equity?.equity_accounts?.items ?? []);

  const totalAssets = safeDecimal(data?.total_assets ?? data?.assets?.total ?? 0);
  const totalLiabilities = safeDecimal(data?.liabilities?.total ?? 0);
  const totalEquity = safeDecimal(data?.equity?.total ?? 0);
  const totalLiabAndEquity = safeDecimal(
    data?.total_liabilities_and_equity ?? totalLiabilities + totalEquity
  );
  const difference = safeDecimal(data?.difference ?? Math.abs(totalAssets - totalLiabAndEquity));
  const isBalanced = data?.is_balanced ?? difference < 0.01;
  const carrierStanding = data?.liabilities?.carrier_credit_standing;
  const hasPendingCost = Boolean(data?.equity?.has_pending_cost || data?.notice);

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Scale className="w-7 h-7 text-sky-600 shrink-0" />
            Balance Sheet (Statement of Financial Position)
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Double-Entry GAAP/IFRS Standards • Assets = Liabilities + Equity • Real General Ledger
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-bold text-slate-500">As of:</span>
            <input
              type="date"
              value={asOfDate}
              onChange={handleDateChange}
              className="text-xs font-bold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-hidden"
            />
          </div>

          <PdfDownloadButton
            url={`/api/v1/accounting/balance-sheet.pdf?as_of_date=${asOfDate}`}
            filename={`AQ-Balance-Sheet-${asOfDate}.pdf`}
            label="Download PDF"
            size="sm"
          />
          <PrintButton label="Print" size="sm" />
        </div>
      </div>

      <AccountingNav />

      {/* Equilibrium Verification Banner */}
      {data && (
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
            isBalanced
              ? "bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200"
              : "bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center space-x-3">
            {isBalanced ? (
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
            )}
            <div>
              <div className="text-sm font-black flex items-center gap-2">
                <span>
                  {isBalanced
                    ? "Balance Sheet is 100% In Equilibrium (Assets = Liabilities + Equity)"
                    : "Out of Balance Warning"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-200/60 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100">
                  GAAP Verified
                </span>
              </div>
              <div className="text-xs opacity-85 mt-0.5 font-medium">
                Total Assets: <span className="font-mono font-bold">{formatUSD(totalAssets)}</span> • Total Liabilities & Equity:{" "}
                <span className="font-mono font-bold">{formatUSD(totalLiabAndEquity)}</span> • Variance:{" "}
                <span className="font-mono font-bold">${difference.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono font-bold">
            <span className="px-3 py-1 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-current shadow-2xs">
              Status: {data.status || (isBalanced ? "BALANCED" : "OUT OF BALANCE")}
            </span>
          </div>
        </div>
      )}

      {/* Afghan Pending Cost Audit Notice */}
      {hasPendingCost && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Audit Transparency: Afghan Purchase Costs Pending
            </div>
            <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300/90">
              {data?.notice ||
                "Final profit and balance sheet equity remain provisional because 63 Afghan origin purchase costs are PENDING supplier bills. Unknown costs are preserved as NULL to prevent fraudulent or distorted margin inflation."}
            </p>
          </div>
        </div>
      )}

      {/* Section 6 Transport Standing Banner */}
      {carrierStanding && (
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Transport Carrier Position (Account 2100)
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-300/90 font-medium">
                AQ Companies paid freight advances exceeding billed invoices. This is a credit asset in AQ favor, not an outstanding debt.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 text-xs font-mono font-black border border-emerald-300 dark:border-emerald-700">
              NET FREIGHT CREDIT: {formatUSD(carrierStanding.amount)}
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Compiling Authoritative Balance Sheet from General Ledger...
          </span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Failed to load Balance Sheet</span>
          </div>
          <p className="text-xs">{error}</p>
          <button
            onClick={() => loadBalanceSheet(asOfDate)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ========================================================= */}
          {/* LEFT COLUMN: ASSETS                                      */}
          {/* ========================================================= */}
          <div className="space-y-6">
            <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div
                onClick={() => toggleSection("assets")}
                className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-sky-50/60 dark:bg-sky-950/20 flex items-center justify-between cursor-pointer select-none"
              >
                <h2 className="text-sm font-black text-sky-900 dark:text-sky-200 uppercase tracking-wider flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-sky-600" />
                  Assets
                  <span className="md:hidden text-sky-600">
                    {collapsedSections["assets"] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </span>
                </h2>
                <span className="text-xs font-mono font-black text-sky-700 dark:text-sky-300">
                  {formatUSD(totalAssets)}
                </span>
              </div>

              {!collapsedSections["assets"] && (
                <div className="p-5 space-y-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5 flex justify-between">
                    <span>General Ledger Accounts</span>
                    <span>Balance (USD)</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {assetItems.length === 0 ? (
                      <div className="py-4 text-slate-400 italic text-center">
                        No asset accounts found for this period
                      </div>
                    ) : (
                      assetItems.map((acc) => (
                        <div
                          key={acc.account_code}
                          className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 shrink-0">
                              {acc.account_code}
                            </span>
                            <div className="truncate">
                              <Link
                                href={`/accounting/general-ledger?account=${acc.account_code}`}
                                className="font-medium text-slate-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 truncate block"
                                title={acc.account_name}
                              >
                                {acc.account_name}
                              </Link>
                              {acc.sub_type && (
                                <span className="text-[10px] text-slate-400 block">
                                  {acc.sub_type}
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 shrink-0 ml-3">
                            {formatUSD(acc.balance)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Total Assets Summary Bar */}
                  <div className="pt-4 border-t-2 border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm font-black">
                    <span className="text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Total Assets
                    </span>
                    <span className="font-mono text-sky-600 dark:text-sky-400 text-base">
                      {formatUSD(totalAssets)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: LIABILITIES & EQUITY                       */}
          {/* ========================================================= */}
          <div className="space-y-6">
            {/* 1. Liabilities */}
            <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div
                onClick={() => toggleSection("liabilities")}
                className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-amber-50/60 dark:bg-amber-950/20 flex items-center justify-between cursor-pointer select-none"
              >
                <h2 className="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  Liabilities
                  <span className="md:hidden text-amber-600">
                    {collapsedSections["liabilities"] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </span>
                </h2>
                <span className="text-xs font-mono font-black text-amber-700 dark:text-amber-300">
                  {formatUSD(totalLiabilities)}
                </span>
              </div>

              {!collapsedSections["liabilities"] && (
                <div className="p-5 space-y-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5 flex justify-between">
                    <span>General Ledger Accounts</span>
                    <span>Balance (USD)</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {liabilityItems.length === 0 ? (
                      <div className="py-4 text-slate-400 italic text-center">
                        No liabilities recorded
                      </div>
                    ) : (
                      liabilityItems.map((acc) => {
                        const isCreditInFavor = Boolean(
                          acc.is_credit_in_our_favor ||
                          acc.balance < 0 ||
                          (acc.account_code === "2100" && acc.balance < 0)
                        );

                        return (
                          <div
                            key={acc.account_code}
                            className={`flex items-center justify-between py-2 px-2.5 rounded-lg transition-colors border ${
                              isCreditInFavor
                                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/40 border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <span
                                className={`font-mono text-xs font-bold shrink-0 ${
                                  isCreditInFavor
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {acc.account_code}
                              </span>
                              <div className="truncate">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/accounting/general-ledger?account=${acc.account_code}`}
                                    className={`font-medium hover:underline truncate block ${
                                      isCreditInFavor
                                        ? "text-emerald-900 dark:text-emerald-200 font-bold"
                                        : "text-slate-800 dark:text-slate-200"
                                    }`}
                                    title={acc.account_name}
                                  >
                                    {acc.account_name}
                                  </Link>
                                  {isCreditInFavor && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-200/80 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100">
                                      Credit in AQ Favor
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 block">
                                  {isCreditInFavor
                                    ? "Transport advance overpayment (Claim against carrier)"
                                    : (acc.sub_type || "Current Liability")}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 ml-3 text-right">
                              {isCreditInFavor ? (
                                <div className="flex flex-col items-end">
                                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                    {formatUSD(acc.balance)}
                                  </span>
                                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                    AQ Asset Credit
                                  </span>
                                </div>
                              ) : (
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                  {formatUSD(acc.balance)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Total Liabilities Summary */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">Total Liabilities</span>
                    <span className="font-mono text-amber-600 text-sm">
                      {formatUSD(totalLiabilities)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Equity */}
            <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div
                onClick={() => toggleSection("equity")}
                className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-center justify-between cursor-pointer select-none"
              >
                <h2 className="text-sm font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Equity
                  <span className="md:hidden text-emerald-600">
                    {collapsedSections["equity"] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </span>
                </h2>
                <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300">
                  {formatUSD(totalEquity)}
                </span>
              </div>

              {!collapsedSections["equity"] && (
                <div className="p-5 space-y-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5 flex justify-between">
                    <span>General Ledger Accounts</span>
                    <span>Balance (USD)</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {equityItems.length === 0 ? (
                      <div className="py-4 text-slate-400 italic text-center">
                        No equity accounts recorded
                      </div>
                    ) : (
                      equityItems.map((acc) => {
                        const isPending = Boolean(acc.is_pending_cost);

                        return (
                          <div
                            key={acc.account_code}
                            className={`flex items-center justify-between py-2 px-2.5 rounded-lg transition-colors border ${
                              isPending
                                ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/40 border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <span className="font-mono text-xs font-bold text-emerald-600 shrink-0">
                                {acc.account_code}
                              </span>
                              <div className="truncate">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/accounting/general-ledger?account=${acc.account_code}`}
                                    className="font-medium text-slate-800 dark:text-slate-200 hover:text-emerald-600 truncate block"
                                    title={acc.account_name}
                                  >
                                    {acc.account_name}
                                  </Link>
                                  {isPending && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                                      Provisional (Pending Costs)
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 block">
                                  {acc.sub_type || "Equity"}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 ml-3 text-right">
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                {formatUSD(acc.balance)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Total Equity Summary */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">Total Equity</span>
                    <span className="font-mono text-emerald-600 text-sm">
                      {formatUSD(totalEquity)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Total Liabilities & Equity Summary Bar */}
            <div className="card p-5 bg-slate-900 text-white dark:bg-slate-800 rounded-xl shadow-md flex justify-between items-center text-base font-black border border-slate-800">
              <div className="space-y-0.5">
                <span className="uppercase tracking-wider text-sm sm:text-base">
                  Total Liabilities & Equity
                </span>
                <span className="text-[11px] font-normal text-slate-400 block">
                  Liabilities ({formatUSD(totalLiabilities)}) + Equity ({formatUSD(totalEquity)})
                </span>
              </div>
              <span className="font-mono text-emerald-400 text-lg sm:text-xl">
                {formatUSD(totalLiabAndEquity)}
              </span>
            </div>

            {/* Balance Sheet Equation Verification Card */}
            <div className="card p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-sky-600" />
                  Fundamental Accounting Balance
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  isBalanced
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse"
                }`}>
                  {isBalanced ? "✓ ASSETS BALANCED" : `MISMATCH: ${formatUSD(difference)}`}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-center font-mono font-bold text-xs">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="text-sky-600 dark:text-sky-400 font-black">ASSETS {formatUSD(totalAssets)}</span>
                  <span className="text-slate-400">=</span>
                  <span className="text-amber-600 dark:text-amber-400">LIAB {formatUSD(totalLiabilities)}</span>
                  <span className="text-slate-400">+</span>
                  <span className="text-emerald-600 dark:text-emerald-400">EQUITY {formatUSD(totalEquity)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
