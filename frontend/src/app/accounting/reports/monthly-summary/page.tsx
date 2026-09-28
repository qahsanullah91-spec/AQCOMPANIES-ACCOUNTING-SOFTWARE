"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Search,
  Printer,
  Download,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

export default function MonthlySummaryReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [fiscalYear, setFiscalYear] = useState<number>(2026);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<any>(`/accounting/reports/monthly-summary?fiscal_year=${fiscalYear}`);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load monthly summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fiscalYear]);

  const months = data?.months || [];

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
            <span className="font-semibold text-slate-700 dark:text-slate-300">Monthly Summary</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Monthly Financial Performance Matrix</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chronological multi-month performance: Invoiced Sales, Collections, Carrier Charges & Cash Flow.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <option value={2026}>Fiscal Year 2026</option>
            <option value={2025}>Fiscal Year 2025</option>
          </select>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Matrix</span>
          </button>
        </div>
      </div>

      {/* Monthly Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
        {months.map((m: any) => (
          <div key={m.month_code} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-base text-slate-900 dark:text-slate-100">{m.month_name}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {m.month_code}
              </span>
            </div>

            <div className="space-y-2 mt-4 text-xs font-mono">
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">Sales Invoiced:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{formatUSD(m.sales_invoiced)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">Customer Receipts:</span>
                <span className="text-emerald-600 font-semibold">{formatUSD(m.customer_receipts)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">Transport Charges:</span>
                <span className="text-rose-600 font-semibold">{formatUSD(m.transport_charges)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">Transport Paid:</span>
                <span className="text-slate-700 dark:text-slate-300">{formatUSD(m.transport_payments)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">Operating Expenses:</span>
                <span className="text-slate-700 dark:text-slate-300">{formatUSD(m.operating_expenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">Bank Fees:</span>
                <span className="text-slate-700 dark:text-slate-300">{formatUSD(m.bank_charges)}</span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-sm">
                <span className="font-sans text-slate-700 dark:text-slate-300">Net Cash Flow:</span>
                <span className={m.net_cash_flow >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {formatUSD(m.net_cash_flow)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1">
                <span className="font-sans text-slate-500">Known Profit:</span>
                <span className="text-emerald-600">{formatUSD(m.known_profit)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Multi-Month Chronological Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-x-auto my-6">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Month</th>
              <th className="py-3 px-4 text-right">Invoiced Sales</th>
              <th className="py-3 px-4 text-right">Customer Receipts</th>
              <th className="py-3 px-4 text-right">Transport Charges</th>
              <th className="py-3 px-4 text-right">Transport Paid</th>
              <th className="py-3 px-4 text-right">Admin Expenses</th>
              <th className="py-3 px-4 text-right">Bank Fees</th>
              <th className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">Net Cash Flow</th>
              <th className="py-3 px-4 text-right font-bold text-emerald-600">Known Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {months.map((m: any) => (
              <tr key={m.month_code} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-slate-100">{m.month_name}</td>
                <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">{formatUSD(m.sales_invoiced)}</td>
                <td className="py-3 px-4 text-right text-emerald-600">{formatUSD(m.customer_receipts)}</td>
                <td className="py-3 px-4 text-right text-rose-600">{formatUSD(m.transport_charges)}</td>
                <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{formatUSD(m.transport_payments)}</td>
                <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{formatUSD(m.operating_expenses)}</td>
                <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{formatUSD(m.bank_charges)}</td>
                <td className={`py-3 px-4 text-right font-bold ${m.net_cash_flow >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatUSD(m.net_cash_flow)}
                </td>
                <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatUSD(m.known_profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
