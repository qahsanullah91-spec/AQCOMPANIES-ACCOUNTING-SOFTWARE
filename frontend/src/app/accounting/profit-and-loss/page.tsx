"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  AlertCircle,
  Calendar,
  Printer,
  FileSpreadsheet,
  Info,
  DollarSign,
  Truck,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";
import {
  PdfDownloadButton,
  PrintButton,
  MoneyDisplay,
} from "@/components/accounting";

export default function ProfitAndLossPage() {
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadData = async (s: string, e: string) => {
    try {
      setLoading(true);
      let url = "/accounting/profit-and-loss";
      const params = new URLSearchParams();
      if (s) params.append("start_date", s);
      if (e) params.append("end_date", e);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetchApi(url);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(startDate, endDate);
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(startDate, endDate);
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    loadData("", "");
  };

  const revenue = data?.revenue || { lines: [], total: 0 };
  const cogs = data?.cogs || { lines: [], total: 0, pending_purchases_count: 0, has_pending_cost: false };
  const grossProfit = data?.gross_profit ?? 0;
  const expenses = data?.operating_expenses || { lines: [], total: 0 };
  const netProfit = data?.net_profit;
  const profitMargin = data?.profit_margin_pct;
  const isPending = cogs.has_pending_cost || netProfit === null;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            Profit & Loss Statement (P&L)
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Trading Revenue, Direct Logistics Costs & Provisional Margin
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <PdfDownloadButton
            url={`/api/v1/accounting/profit-loss.pdf?${startDate ? `start_date=${startDate}&` : ""}${endDate ? `end_date=${endDate}` : ""}`}
            filename={`AQ-Profit-Loss-${startDate || "All"}-to-${endDate || "All"}.pdf`}
            label="Download PDF"
            size="sm"
          />
          <PrintButton label="Print" size="sm" />
        </div>
      </div>

      <AccountingNav />

      {/* Date Range Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
        <form onSubmit={handleFilter} className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Period Filter:</span>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-slate-500 font-medium">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input py-1 text-xs"
            />
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-slate-500 font-medium">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input py-1 text-xs"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button type="submit" className="btn btn-primary text-xs py-1 px-3">
              Apply Filter
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-secondary text-xs py-1 px-3"
              >
                Reset (All Time)
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Critical Afghan Cost Status Alert */}
      {isPending && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-black tracking-wide text-amber-900 dark:text-amber-200 uppercase">
              FINAL PROFIT INCOMPLETE — PURCHASE COSTS ARE STILL PENDING.
            </div>
            <p className="text-amber-800 dark:text-amber-300/90 mt-1 leading-relaxed">
              AQ Companies strictly adheres to zero-guess financial accounting. {cogs.pending_purchases_count} Afghan origin dry fruit purchase orders currently have pending supplier invoice values. While sales revenues (${formatUSD(revenue.total)}) and transport freight costs (${formatUSD(cogs.total)}) are 100% verified, final Net Profit remains marked as <strong>PENDING</strong> until supplier purchase bills are entered.
            </p>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="card p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Total Sales Revenue</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
            {formatUSD(revenue.total)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Verified Sales Invoices</p>
        </div>

        {/* COGS (Transport + Direct Costs) */}
        <div className="card p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Direct Transport Costs</span>
            <Truck className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {formatUSD(cogs.total)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Carrier Freight & Border Crossings</p>
        </div>

        {/* Provisional Margin */}
        <div className="card p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Provisional Margin</span>
            <DollarSign className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
            {formatUSD(grossProfit)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Revenue minus Freight Costs</p>
        </div>

        {/* Net Profit */}
        <div className="card p-4 bg-slate-50/50 dark:bg-slate-900/40 border-dashed">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Final Net Profit</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
            {netProfit !== null ? formatUSD(netProfit) : "PENDING SUPPLIER INVOICE"}
          </div>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">
            Requires Afghan purchase costs
          </p>
        </div>
      </div>

      {/* Main Statement Breakdown */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Statement of Comprehensive Income
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            Currency: USD • Standard Double-Entry Format
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {/* Section 1: REVENUE */}
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 font-black text-sm pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="tracking-wide">1. OPERATING REVENUE</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {formatUSD(revenue.total)}
              </span>
            </div>

            <div className="space-y-2 pl-4">
              {revenue.lines.length === 0 ? (
                <div className="text-slate-400 py-1 italic">No revenue recorded in this period.</div>
              ) : (
                revenue.lines.map((l: any) => (
                  <div key={l.account_code} className="flex items-center justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-300">
                      <span className="font-mono text-slate-400 mr-2">{l.account_code}</span>
                      {l.account_name}
                    </span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {formatUSD(l.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 2: COST OF GOODS SOLD */}
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 font-black text-sm pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="tracking-wide">2. COST OF GOODS SOLD (DIRECT COSTS)</span>
              <span className="font-mono text-rose-600 dark:text-rose-400">
                ({formatUSD(cogs.total)})
              </span>
            </div>

            <div className="space-y-2 pl-4">
              {cogs.lines.map((l: any) => (
                <div key={l.account_code} className="flex items-center justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-300">
                    <span className="font-mono text-slate-400 mr-2">{l.account_code}</span>
                    {l.account_name}
                  </span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    {formatUSD(l.amount)}
                  </span>
                </div>
              ))}

              {/* Notice for unpriced purchases */}
              <div className="flex items-center justify-between py-1 text-amber-600 dark:text-amber-400 italic bg-amber-500/5 px-2 rounded">
                <span>
                  <span className="font-mono text-amber-500 mr-2">5000</span>
                  Purchase Cost of Dry Fruits (Afghan Origin)
                </span>
                <span className="font-mono font-bold">
                  PENDING SUPPLIER INVOICE ({cogs.pending_purchases_count} POs)
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: GROSS PROFIT */}
          <div className="p-6 bg-slate-50/70 dark:bg-slate-800/20">
            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 font-black text-sm">
              <span>GROSS PROFIT / PROVISIONAL MARGIN</span>
              <span className="font-mono text-sky-600 dark:text-sky-400 text-base">
                {formatUSD(grossProfit)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Reflects Total Revenue minus Direct Freight & Logistics Incurred.
            </p>
          </div>

          {/* Section 4: OPERATING EXPENSES */}
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 font-black text-sm pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="tracking-wide">3. OPERATING & GENERAL EXPENSES</span>
              <span className="font-mono text-rose-600 dark:text-rose-400">
                ({formatUSD(expenses.total)})
              </span>
            </div>

            <div className="space-y-2 pl-4">
              {expenses.lines.length === 0 ? (
                <div className="text-slate-400 py-1 italic">
                  No general operating expenses recorded in this period.
                </div>
              ) : (
                expenses.lines.map((l: any) => (
                  <div key={l.account_code} className="flex items-center justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-300">
                      <span className="font-mono text-slate-400 mr-2">{l.account_code}</span>
                      {l.account_name}
                    </span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {formatUSD(l.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 5: NET PROFIT */}
          <div className="p-6 bg-sky-50/50 dark:bg-sky-950/20">
            <div className="flex items-center justify-between text-slate-900 dark:text-slate-100 font-black text-base">
              <span>NET OPERATING PROFIT</span>
              <span className="font-mono text-base">
                {netProfit !== null ? (
                  <span className={netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>
                    {formatUSD(netProfit)}
                  </span>
                ) : (
                  <span className="badge badge-warning text-xs font-mono font-bold px-3 py-1">
                    PROFIT NOT YET CALCULABLE (PENDING PURCHASE COST)
                  </span>
                )}
              </span>
            </div>
            {profitMargin !== null && (
              <div className="flex justify-end text-xs text-slate-500 font-mono mt-1">
                Net Margin: {profitMargin}%
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
