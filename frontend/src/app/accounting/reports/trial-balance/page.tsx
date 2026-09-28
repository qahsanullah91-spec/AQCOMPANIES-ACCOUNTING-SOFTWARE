"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Layers,
  Search,
  Filter,
  Printer,
  Download,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

export default function DetailedTrialBalancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "/accounting/reports/trial-balance";
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (params.toString()) endpoint += `?${params.toString()}`;

      const res = await fetchApi<any>(endpoint);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load Trial Balance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const tot = data?.totals;
  const accounts = (data?.accounts || []).filter((acc: any) => {
    const matchesSearch =
      acc.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.account_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "ALL" || acc.account_type === typeFilter;
    return matchesSearch && matchesType;
  });

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
            <span className="font-semibold text-slate-700 dark:text-slate-300">Trial Balance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">8-Column Extended Trial Balance</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Double-entry ledger balances: Opening Dr/Cr, Period Movements Dr/Cr, and Closing Dr/Cr.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          />
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Apply Filter</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Balanced Status Banner */}
      <div className={`my-6 p-4 rounded-xl border flex items-center justify-between shadow-2xs ${
        tot?.is_balanced
          ? "border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
          : "border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
      }`}>
        <div className="flex items-center space-x-3">
          {tot?.is_balanced ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <div>
            <span className="font-bold text-sm block">
              {tot?.is_balanced ? "TRIAL BALANCE BALANCED (DIFFERENCE = $0.00)" : "TRIAL BALANCE OUT OF BALANCE"}
            </span>
            <span className="text-xs">
              Total Debits ({formatUSD(tot?.closing_debit || 0)}) = Total Credits ({formatUSD(tot?.closing_credit || 0)})
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-wider block font-semibold text-slate-500">Difference</span>
          <span className="text-lg font-mono font-black">{formatUSD(tot?.difference || 0)}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search account code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto">
          {["ALL", "ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                typeFilter === type
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* 8-Column Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-x-auto my-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4" rowSpan={2}>Code</th>
              <th className="py-3 px-4" rowSpan={2}>Account Name</th>
              <th className="py-3 px-4" rowSpan={2}>Type</th>
              <th className="py-2 px-4 text-center border-l border-slate-200 dark:border-slate-800" colSpan={2}>Opening Balance</th>
              <th className="py-2 px-4 text-center border-l border-slate-200 dark:border-slate-800" colSpan={2}>Period Activity</th>
              <th className="py-2 px-4 text-center border-l border-slate-200 dark:border-slate-800 bg-sky-50/50 dark:bg-sky-950/20" colSpan={2}>Closing Balance</th>
            </tr>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 font-semibold">
              <th className="py-2 px-4 text-right border-l border-slate-200 dark:border-slate-800">Debit ($)</th>
              <th className="py-2 px-4 text-right">Credit ($)</th>
              <th className="py-2 px-4 text-right border-l border-slate-200 dark:border-slate-800">Debit ($)</th>
              <th className="py-2 px-4 text-right">Credit ($)</th>
              <th className="py-2 px-4 text-right border-l border-slate-200 dark:border-slate-800 bg-sky-50/50 dark:bg-sky-950/20 font-bold">Debit ($)</th>
              <th className="py-2 px-4 text-right bg-sky-50/50 dark:bg-sky-950/20 font-bold">Credit ($)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
            {accounts.map((acc: any) => (
              <tr key={acc.account_code} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-4 font-bold text-sky-600 dark:text-sky-400">{acc.account_code}</td>
                <td className="py-2.5 px-4 font-sans text-slate-800 dark:text-slate-200 font-medium">{acc.account_name}</td>
                <td className="py-2.5 px-4 font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {acc.account_type}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right border-l border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  {acc.opening_debit > 0 ? formatUSD(acc.opening_debit) : "-"}
                </td>
                <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-400">
                  {acc.opening_credit > 0 ? formatUSD(acc.opening_credit) : "-"}
                </td>
                <td className="py-2.5 px-4 text-right border-l border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  {acc.period_debit > 0 ? formatUSD(acc.period_debit) : "-"}
                </td>
                <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-400">
                  {acc.period_credit > 0 ? formatUSD(acc.period_credit) : "-"}
                </td>
                <td className="py-2.5 px-4 text-right border-l border-slate-100 dark:border-slate-800 bg-sky-50/20 dark:bg-sky-950/10 font-bold text-slate-900 dark:text-slate-100">
                  {acc.closing_debit > 0 ? formatUSD(acc.closing_debit) : "-"}
                </td>
                <td className="py-2.5 px-4 text-right bg-sky-50/20 dark:bg-sky-950/10 font-bold text-slate-900 dark:text-slate-100">
                  {acc.closing_credit > 0 ? formatUSD(acc.closing_credit) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-black">
              <td className="py-3 px-4 font-sans" colSpan={3}>TOTAL EXTENDED TRIAL BALANCE</td>
              <td className="py-3 px-4 text-right border-l border-slate-300 dark:border-slate-700 font-mono">
                {formatUSD(tot?.opening_debit || 0)}
              </td>
              <td className="py-3 px-4 text-right font-mono">
                {formatUSD(tot?.opening_credit || 0)}
              </td>
              <td className="py-3 px-4 text-right border-l border-slate-300 dark:border-slate-700 font-mono">
                {formatUSD(tot?.period_debit || 0)}
              </td>
              <td className="py-3 px-4 text-right font-mono">
                {formatUSD(tot?.period_credit || 0)}
              </td>
              <td className="py-3 px-4 text-right border-l border-slate-300 dark:border-slate-700 bg-sky-100/50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-mono text-sm">
                {formatUSD(tot?.closing_debit || 0)}
              </td>
              <td className="py-3 px-4 text-right bg-sky-100/50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-mono text-sm">
                {formatUSD(tot?.closing_credit || 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
