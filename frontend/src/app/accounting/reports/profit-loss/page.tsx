"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Printer,
  Download,
  ArrowLeft,
  RefreshCw,
  Info,
  DollarSign,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

export default function ProfitAndLossReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [comparePeriod, setComparePeriod] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "/accounting/reports/profit-loss";
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (comparePeriod) params.append("compare_period", comparePeriod);
      if (params.toString()) endpoint += `?${params.toString()}`;

      const res = await fetchApi<any>(endpoint);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load Profit & Loss statement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [comparePeriod]);

  const cur = data?.current_period;
  const prev = data?.previous_period;
  const comp = data?.comparison;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
      <AccountingNav />

      {/* Breadcrumb & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link href="/accounting/reports" className="hover:text-sky-600 flex items-center space-x-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Financial Report Center</span>
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Profit & Loss</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Statement of Profit & Loss (Income Statement)</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            GAAP double-entry revenue and expense recognition with null-safe Afghan purchase cost protection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Compare dropdown */}
          <select
            value={comparePeriod}
            onChange={(e) => setComparePeriod(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <option value="">No Comparison</option>
            <option value="PREVIOUS_MONTH">Compare Previous Month</option>
            <option value="PREVIOUS_YEAR">Compare Previous Year</option>
          </select>

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
            <span>Print P&L</span>
          </button>
        </div>
      </div>

      {/* Preliminary Afghan Purchase Cost Warning Banner */}
      {data && !data.is_profit_complete && (
        <div className="my-6 p-4 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-start space-x-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-sm block mb-0.5">
              PRELIMINARY REPORT — {data.pending_purchase_costs_count} SHIPMENTS WITH PENDING PURCHASE INVOICES
            </span>
            <p>
              In accordance with Section 3 & 4 accounting rules, supplier purchase costs are pending for {data.pending_purchase_costs_count} shipments from Afghanistan. These have NOT been set to $0.00 to avoid false profit inflation.
              The Net Profit shown below (${formatUSD(cur?.net_profit || 0)}) is strictly <strong>PRELIMINARY / PROFIT PENDING</strong> until supplier purchase bills arrive.
            </p>
          </div>
        </div>
      )}

      {/* Main Statement Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales Invoiced</span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatUSD(cur?.sales_revenue || 0)}
          </div>
          <span className="text-xs text-slate-400">Account 4000 Sales Revenue</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirmed Direct Costs</span>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {formatUSD(cur?.total_cogs || 0)}
          </div>
          <span className="text-xs text-slate-400">Freight ($743,650) + Bank/Clearance</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Known Gross Profit</span>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatUSD(cur?.gross_profit || 0)}
          </div>
          <span className="text-xs text-slate-400">Margin: {cur?.gross_margin_pct || 0}% (Preliminary)</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Known Net Profit</span>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatUSD(cur?.net_profit || 0)}
          </div>
          <span className="text-xs text-amber-500 font-semibold">Status: {data?.status || "PRELIMINARY"}</span>
        </div>
      </div>

      {/* Detailed GAAP P&L Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden my-6">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Statement of Profit & Loss
          </h2>
          <span className="text-xs font-mono text-slate-500">
            Period: {data?.period?.start_date} to {data?.period?.end_date}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {/* REVENUE SECTION */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            1. Operating Revenue & Income
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="font-mono text-xs text-slate-500">4000 &bull; Sales Invoiced (Export Customs & Invoices)</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{formatUSD(cur?.sales_revenue || 0)}</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="font-mono text-xs text-slate-500">4100 &bull; Other Operating Income</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{formatUSD(cur?.other_income || 0)}</span>
          </div>
          <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-sm font-bold border-t border-b border-slate-200 dark:border-slate-800">
            <span>Total Revenue</span>
            <span className="text-slate-900 dark:text-slate-100">{formatUSD(cur?.total_revenue || 0)}</span>
          </div>

          {/* DIRECT COSTS / COGS */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            2. Cost of Goods Sold & Direct Shipment Costs
          </div>
          {cur?.cogs_items?.map((item: any) => (
            <div key={item.code} className="px-6 py-3 flex items-center justify-between text-sm">
              <span className="font-mono text-xs text-slate-500">{item.code} &bull; {item.name}</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">{formatUSD(item.amount)}</span>
            </div>
          ))}
          <div className="px-6 py-3.5 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between text-sm font-bold border-t border-b border-slate-200 dark:border-slate-800 text-rose-700 dark:text-rose-300">
            <span>Total Direct Costs</span>
            <span>{formatUSD(cur?.total_cogs || 0)}</span>
          </div>

          {/* GROSS PROFIT */}
          <div className="px-6 py-4 bg-slate-100 dark:bg-slate-800 flex items-center justify-between text-base font-extrabold text-slate-900 dark:text-slate-100">
            <div>
              <span>Known Gross Profit (Preliminary)</span>
              <span className="text-xs font-normal text-slate-500 block">Total Revenue minus Total Direct Costs</span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400">{formatUSD(cur?.gross_profit || 0)}</span>
          </div>

          {/* OPERATING EXPENSES */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            3. Operating & Administrative Expenses
          </div>
          {cur?.opex_items?.map((item: any) => (
            <div key={item.code} className="px-6 py-3 flex items-center justify-between text-sm">
              <span className="font-mono text-xs text-slate-500">{item.code} &bull; {item.name}</span>
              <span className="text-slate-700 dark:text-slate-300">{formatUSD(item.amount)}</span>
            </div>
          ))}
          <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-sm font-bold border-t border-b border-slate-200 dark:border-slate-800">
            <span>Total Operating Expenses</span>
            <span>{formatUSD(cur?.total_opex || 0)}</span>
          </div>

          {/* OPERATING PROFIT */}
          <div className="px-6 py-3.5 flex items-center justify-between text-sm font-bold bg-slate-50/30 dark:bg-slate-900/30">
            <span>Operating Profit (EBIT)</span>
            <span className="text-slate-900 dark:text-slate-100">{formatUSD(cur?.operating_profit || 0)}</span>
          </div>

          {/* OTHER INCOME / EXPENSE */}
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="font-mono text-xs text-slate-500">4200 &bull; Foreign Exchange Realized Gain</span>
            <span className="text-emerald-600">{formatUSD(cur?.fx_gain || 0)}</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <span className="font-mono text-xs text-slate-500">6500 &bull; Foreign Exchange Realized Loss</span>
            <span className="text-rose-600">{formatUSD(cur?.fx_loss || 0)}</span>
          </div>

          {/* NET PROFIT */}
          <div className="px-6 py-5 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-between text-lg font-black text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
            <div>
              <span>Known Net Profit / (Loss)</span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 block">
                {data?.is_profit_complete ? "Final Audited Profit" : `PRELIMINARY — ${data?.pending_purchase_costs_count} Purchase Costs Pending`}
              </span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400">{formatUSD(cur?.net_profit || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
