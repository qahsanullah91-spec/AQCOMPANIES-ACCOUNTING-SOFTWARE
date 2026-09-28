"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Printer,
  Download,
  ArrowLeft,
  RefreshCw,
  Wallet,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

export default function CashFlowReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "/accounting/reports/cash-flow";
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (params.toString()) endpoint += `?${params.toString()}`;

      const res = await fetchApi<any>(endpoint);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load Cash Flow Statement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const op = data?.operating_activities;
  const inv = data?.investing_activities;
  const fin = data?.financing_activities;
  const summary = data?.summary;

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
            <span className="font-semibold text-slate-700 dark:text-slate-300">Cash Flow Statement</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Statement of Cash Flows (Direct Method)</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Authoritative cash inflows and outflows reconciled with commercial bank, cash vault, and Sarafi ledgers.
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
            <span>Apply</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Operating Cash Flow</span>
          <div className={`text-xl font-bold mt-1 ${
            (op?.net_operating_cash_flow || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}>
            {formatUSD(op?.net_operating_cash_flow || 0)}
          </div>
          <span className="text-xs text-slate-400">Collections minus Freight/Suppliers</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Period Cash Movement</span>
          <div className={`text-xl font-bold mt-1 ${
            (summary?.net_cash_movement || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}>
            {formatUSD(summary?.net_cash_movement || 0)}
          </div>
          <span className="text-xs text-slate-400">Total Liquid Inflows minus Outflows</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Closing Liquid Cash & Banks</span>
          <div className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-1">
            {formatUSD(summary?.closing_cash_and_banks || 0)}
          </div>
          <span className="text-xs text-slate-400">All Commercial, Cash & Sarafi Desks</span>
        </div>
      </div>

      {/* Detailed Direct-Method Statement */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden my-6">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Direct Method Cash Flow Reconciliation
          </h2>
          <span className="text-xs font-mono text-slate-500">
            Period: {data?.period?.start_date} to {data?.period?.end_date}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {/* 1. OPERATING ACTIVITIES */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            1. Cash Flows from Operating Activities
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">Cash Receipts from Customers (Invoices & Advances)</span>
            <span className="text-emerald-600 font-semibold">{formatUSD(op?.customer_receipts || 0)}</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">Other Inflows & Recoveries</span>
            <span className="text-emerald-600 font-semibold">{formatUSD(op?.other_inflows || 0)}</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">Payments to Transport Companies (Sky Ariana Freight & Advances)</span>
            <span className="text-rose-600 font-semibold">({formatUSD(op?.transport_payments || 0)})</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">Payments to Goods Suppliers</span>
            <span className="text-rose-600 font-semibold">({formatUSD(op?.supplier_payments || 0)})</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">Cash Paid for Operating Expenses & Administration</span>
            <span className="text-rose-600 font-semibold">({formatUSD(op?.operating_expenses || 0)})</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">Bank Wire Fees, Swift & Sarafi Commissions</span>
            <span className="text-rose-600 font-semibold">({formatUSD(op?.bank_charges || 0)})</span>
          </div>
          <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-sm font-bold border-t border-b border-slate-200 dark:border-slate-800">
            <span>Net Cash from Operating Activities</span>
            <span className={op?.net_operating_cash_flow >= 0 ? "text-emerald-600" : "text-rose-600"}>
              {formatUSD(op?.net_operating_cash_flow || 0)}
            </span>
          </div>

          {/* 2. INVESTING ACTIVITIES */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            2. Cash Flows from Investing Activities
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">Capital Expenditures & Equipment Purchases</span>
            <span className="text-rose-600 font-semibold">({formatUSD(inv?.capital_expenditures || 0)})</span>
          </div>
          <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-sm font-bold border-t border-b border-slate-200 dark:border-slate-800">
            <span>Net Cash from Investing Activities</span>
            <span>{formatUSD(inv?.net_investing_cash_flow || 0)}</span>
          </div>

          {/* 3. FINANCING ACTIVITIES */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            3. Cash Flows from Financing Activities
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">Capital Injections / Equity Contributions</span>
            <span className="text-emerald-600 font-semibold">{formatUSD(fin?.owner_capital_injected || 0)}</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">Owner Draws & Distributions</span>
            <span className="text-rose-600 font-semibold">({formatUSD(fin?.owner_draws || 0)})</span>
          </div>
          <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-sm font-bold border-t border-b border-slate-200 dark:border-slate-800">
            <span>Net Cash from Financing Activities</span>
            <span>{formatUSD(fin?.net_financing_cash_flow || 0)}</span>
          </div>

          {/* SUMMARY RECONCILIATION */}
          <div className="p-4 bg-slate-100 dark:bg-slate-800 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            4. Net Cash Reconciliation
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-700 dark:text-slate-300">Opening Liquid Cash & Bank Balances</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{formatUSD(summary?.opening_cash_and_banks || 0)}</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm font-semibold">
            <span className="text-slate-700 dark:text-slate-300">Net Increase / (Decrease) in Cash</span>
            <span className={summary?.net_cash_movement >= 0 ? "text-emerald-600" : "text-rose-600"}>
              {formatUSD(summary?.net_cash_movement || 0)}
            </span>
          </div>
          <div className="px-6 py-5 bg-sky-50 dark:bg-sky-950/30 flex items-center justify-between text-base font-extrabold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
            <span>Closing Liquid Cash & Bank Balances</span>
            <span className="text-sky-600 dark:text-sky-400 text-lg font-mono">
              {formatUSD(summary?.closing_cash_and_banks || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
