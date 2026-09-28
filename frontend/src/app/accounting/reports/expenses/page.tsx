"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Printer,
  Download,
  ArrowLeft,
  RefreshCw,
  Landmark,
  FileText,
  DollarSign,
  TrendingDown,
  PieChart,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

export default function ExpenseReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    try {
      let endpoint = "/accounting/reports/expenses";
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (params.toString()) endpoint += `?${params.toString()}`;

      const res = await fetchApi<any>(endpoint);
      setData(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = data?.categories || [];
  const bankCharges = data?.bank_charges_by_bank || [];

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
            <span className="font-semibold text-slate-700 dark:text-slate-300">Expense Analysis</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Expense Breakdown & Bank Charge Cost Analysis</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Categorical operating expenses &bull; Comparative wire charges, transaction counts, and average fees per bank.
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
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 shadow-2xs"
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Direct & Operating Expenses</span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">
            {formatUSD(data?.total_expenses || 0)}
          </div>
          <span className="text-xs text-slate-400">Freight, customs, clearance, documentation & overhead</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Bank Wire Charges</span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatUSD(data?.total_bank_charges || 0)}
          </div>
          <span className="text-xs text-slate-400">Section 29: SWIFT, wire commissions & transfer fees</span>
        </div>
      </div>

      {/* Grid: Categories & Bank Charges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
        {/* Categories */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-sky-600" />
              <span>Expense Breakdown by Category</span>
            </h2>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {categories.map((c: any) => (
              <div key={c.account_code} className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="font-mono text-slate-400 mr-2">{c.account_code}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{c.category_name}</span>
                </div>
                <span className="font-bold font-mono text-rose-600 dark:text-rose-400 text-sm">
                  {formatUSD(c.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bank Charges Analysis (Section 29) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Landmark className="w-4 h-4 text-sky-600" />
              <span>Section 29: Bank Charge Cost Analysis</span>
            </h2>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-4">Bank Name</th>
                <th className="py-2.5 px-4 text-center">Tx Count</th>
                <th className="py-2.5 px-4 text-right">Total Charges</th>
                <th className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100">Avg / Wire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {bankCharges.map((b: any) => (
                <tr key={b.bank_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-slate-100">
                    {b.bank_name} <span className="text-[10px] text-slate-400 font-normal">({b.currency})</span>
                  </td>
                  <td className="py-3 px-4 text-center font-sans text-slate-500">{b.transaction_count}</td>
                  <td className="py-3 px-4 text-right text-rose-600 font-semibold">{formatUSD(b.total_charges)}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                    {formatUSD(b.average_charge)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
