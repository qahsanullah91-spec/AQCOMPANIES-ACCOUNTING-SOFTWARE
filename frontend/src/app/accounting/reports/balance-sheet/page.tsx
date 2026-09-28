"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Scale,
  ShieldCheck,
  Printer,
  Download,
  ArrowLeft,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

export default function BalanceSheetReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [asOfDate, setAsOfDate] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "/accounting/reports/balance-sheet";
      if (asOfDate) endpoint += `?as_of_date=${asOfDate}`;
      const res = await fetchApi<any>(endpoint);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load Balance Sheet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const assets = data?.assets;
  const liabilities = data?.liabilities;
  const equity = data?.equity;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
      <AccountingNav />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link href="/accounting/reports" className="hover:text-sky-600 flex items-center space-x-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Financial Report Center</span>
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Balance Sheet</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Statement of Financial Position (Balance Sheet)</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Assets = Liabilities + Equity &bull; Enforces Section 6 Transport Advance Asset Presentation
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          />
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Apply</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* Balance Verification Banner */}
      <div className={`my-6 p-4 rounded-xl border flex items-center justify-between shadow-2xs ${
        data?.is_balanced
          ? "border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
          : "border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
      }`}>
        <div className="flex items-center space-x-3">
          {data?.is_balanced ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <div>
            <span className="font-bold text-sm block">
              {data?.is_balanced ? "BALANCE SHEET EQUATION FULLY BALANCED ($0.00 DIFFERENCE)" : "BALANCE SHEET OUT OF BALANCE"}
            </span>
            <span className="text-xs">
              Total Assets ({formatUSD(assets?.total_assets || 0)}) = Total Liabilities & Equity ({formatUSD(data?.total_liabilities_and_equity || 0)})
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-wider block font-semibold text-slate-500">Difference</span>
          <span className="text-lg font-mono font-black">{formatUSD(data?.balance_difference || 0)}</span>
        </div>
      </div>

      {/* Transport Advance Highlight Alert */}
      <div className="mb-6 p-4 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-200 flex items-start space-x-3">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold text-sm block mb-0.5">SECTION 6 COMPLIANCE: TRANSPORT ADVANCE / CARRIER CREDIT PRESENTATION</span>
          <p>
            AQ Companies paid $1,030,000.00 to carrier Sky Ariana against $743,650.00 freight charges, with $4,810.00 opening credit.
            The standing credit balance of <strong>$321,160.00</strong> ($291,160.00 net freight + $30,000 operational advance) is strictly classified as an <strong>ASSET (Transport Advance / Carrier Credit)</strong>.
            It does NOT appear as a liability.
          </p>
        </div>
      </div>

      {/* Dual Column Layout: Assets vs Liabilities & Equity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 my-6">
        {/* ASSETS COLUMN */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Assets</h2>
            <span className="text-xs font-semibold text-slate-500">As of: {data?.as_of_date}</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="p-3 bg-slate-50/60 dark:bg-slate-900/60 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Current Assets
            </div>

            {assets?.current_assets?.map((item: any, idx: number) => {
              const isTransportAdv = item.name.includes("Transport Advance");
              return (
                <div
                  key={idx}
                  className={`px-5 py-3 flex items-center justify-between text-sm ${
                    isTransportAdv ? "bg-sky-50/50 dark:bg-sky-950/20 font-semibold" : ""
                  }`}
                >
                  <div>
                    <span className="font-mono text-xs text-slate-400 mr-2">{item.code}</span>
                    <span className="text-slate-800 dark:text-slate-200">{item.name}</span>
                    {isTransportAdv && (
                      <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300">
                        Section 6 Asset Rule
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{formatUSD(item.amount)}</span>
                </div>
              );
            })}

            <div className="p-3 bg-slate-50/60 dark:bg-slate-900/60 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Non-Current Assets
            </div>

            {assets?.non_current_assets?.map((item: any, idx: number) => (
              <div key={idx} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono text-xs text-slate-400 mr-2">{item.code}</span>
                  <span className="text-slate-800 dark:text-slate-200">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatUSD(item.amount)}</span>
              </div>
            ))}

            <div className="p-5 bg-slate-100 dark:bg-slate-800 flex items-center justify-between text-base font-extrabold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
              <span>Total Assets</span>
              <span className="text-sky-600 dark:text-sky-400 text-lg">{formatUSD(assets?.total_assets || 0)}</span>
            </div>
          </div>
        </div>

        {/* LIABILITIES & EQUITY COLUMN */}
        <div className="space-y-6">
          {/* LIABILITIES */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Liabilities</h2>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/60 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Current Liabilities
              </div>

              {liabilities?.current_liabilities?.map((item: any, idx: number) => (
                <div key={idx} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-mono text-xs text-slate-400 mr-2">{item.code}</span>
                    <span className="text-slate-800 dark:text-slate-200">{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{formatUSD(item.amount)}</span>
                </div>
              ))}

              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-sm font-bold border-t border-slate-200 dark:border-slate-800">
                <span>Total Liabilities</span>
                <span>{formatUSD(liabilities?.total_liabilities || 0)}</span>
              </div>
            </div>
          </div>

          {/* EQUITY */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Owner's Equity</h2>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {equity?.equity_items?.map((item: any, idx: number) => (
                <div key={idx} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-mono text-xs text-slate-400 mr-2">{item.code}</span>
                    <span className="text-slate-800 dark:text-slate-200">{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{formatUSD(item.amount)}</span>
                </div>
              ))}

              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-sm font-bold border-t border-slate-200 dark:border-slate-800">
                <span>Total Equity</span>
                <span>{formatUSD(equity?.total_equity || 0)}</span>
              </div>
            </div>
          </div>

          {/* TOTAL LIABILITIES & EQUITY */}
          <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-base font-extrabold text-slate-900 dark:text-slate-100">
            <span>Total Liabilities & Equity</span>
            <span className="text-emerald-600 dark:text-emerald-400 text-lg">
              {formatUSD(data?.total_liabilities_and_equity || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
