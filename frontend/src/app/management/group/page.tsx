"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  TrendingUp,
  DollarSign,
  ArrowRightLeft,
  Scale,
  RefreshCw,
  Wallet,
  Container,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Users,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { API_BASE } from "@/lib/api";

export default function GroupManagementPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchGroupSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/management/group-summary`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching group management summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupSummary();
  }, []);

  const kpis = data?.kpis || {};
  const companies = data?.companies || [];
  const treasuryCurrencies = data?.treasury_by_currency || {};
  const reconciliation = data?.reconciliation || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AccountingNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  Group Executive Management
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                  {companies.length} Legal Entities
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Consolidated cross-entity performance, centralized group treasury, and commercial operations
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchGroupSummary}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Group Data</span>
          </button>

          <Link
            href="/treasury"
            className="flex items-center space-x-1 px-3 py-1.5 bg-sky-600 text-white text-xs font-bold rounded-lg hover:bg-sky-700 transition"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Central Treasury</span>
          </Link>

          <Link
            href="/settings/companies"
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Manage Entities</span>
          </Link>
        </div>
      </div>

      {/* Executive KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Group Sales */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Group Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ${(kpis.total_group_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center space-x-1">
            <span>Aggregated across all business entities</span>
          </div>
        </div>

        {/* Central Treasury Cash */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Treasury Cash</span>
            <Wallet className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">
            ${(kpis.total_group_cash || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Bank accounts, vaults & Sarafi liquidity
          </div>
        </div>

        {/* Group Receivables */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Group Receivables</span>
            <ArrowUpRight className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            ${(kpis.total_group_receivables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Customer outstanding invoices
          </div>
        </div>

        {/* Group Payables */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Group Payables</span>
            <DollarSign className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            ${(kpis.total_group_payables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Supplier & vendor obligations
          </div>
        </div>
      </div>

      {/* Secondary Metric Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Trade Cargo Volume */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Net Cargo</div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {(kpis.total_group_kg || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })} KG
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
            KG
          </div>
        </div>

        {/* Active Containers */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shipments / Containers</div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {kpis.total_containers || 0} units
            </div>
          </div>
          <Container className="w-5 h-5 text-indigo-500" />
        </div>

        {/* Intercompany Reconciliation Status */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Intercompany Status</div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${kpis.intercompany_status === "BALANCED" ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span className={kpis.intercompany_status === "BALANCED" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}>
                {kpis.intercompany_status || "BALANCED"}
              </span>
            </div>
          </div>
          <ArrowRightLeft className="w-5 h-5 text-purple-500" />
        </div>

        {/* Known Group Profit */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trading Margin / Profit</div>
            <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              ${(kpis.total_group_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <Scale className="w-5 h-5 text-emerald-500" />
        </div>
      </div>

      {/* Multi-Currency Treasury Bar */}
      <div className="p-4 rounded-xl bg-slate-900 text-white shadow-md">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <Wallet className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Central Treasury Multi-Currency Reserves</span>
          </div>
          <Link href="/treasury" className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center space-x-1">
            <span>Treasury Console</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {["USD", "AFN", "AED", "INR"].map((cur) => {
            const item = treasuryCurrencies[cur] || { original: 0, usd_equivalent: 0 };
            return (
              <div key={cur} className="bg-slate-800/70 p-3 rounded-lg border border-slate-700/60">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold text-slate-200">{cur} Holdings</span>
                  <span className="font-mono text-[10px]">FX: {cur === "USD" ? "1.00" : cur === "AFN" ? "70.0" : cur === "AED" ? "3.6725" : "85.0"}</span>
                </div>
                <div className="text-base font-black font-mono mt-1 text-white">
                  {item.original.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-sans">{cur}</span>
                </div>
                <div className="text-[10px] text-sky-400 font-mono mt-0.5">
                  ≈ ${item.usd_equivalent.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Entity Performance Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-purple-600" />
            <span>Entities Performance Matrix</span>
          </h2>
          <span className="text-xs text-slate-500">Live subledger data</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {companies.map((c: any) => (
            <div
              key={c.company_id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition space-y-3 relative overflow-hidden"
              style={{ borderTop: `4px solid ${c.color_accent || "#2563eb"}` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {c.company_code}
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1 leading-snug">
                    {c.company_name}
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {c.country}
                </span>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 font-mono text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="font-sans text-[11px]">Sales:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ${c.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="font-sans text-[11px]">Receivables:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    ${c.receivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="font-sans text-[11px]">Payables:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    ${c.payables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="font-sans text-[11px]">Cash Reserves:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">
                    ${c.cash_position.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="font-sans text-[11px]">Net Volume:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {c.net_kg.toLocaleString(undefined, { minimumFractionDigits: 1 })} KG
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">{c.containers} Containers</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ${c.known_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })} Profit
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Entity Comparison Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Comparative Group Balance Sheet & Commercial Breakdown
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Real-time DB query</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Country</th>
                <th className="py-3 px-4 text-right">Invoices</th>
                <th className="py-3 px-4 text-right">Sales (USD)</th>
                <th className="py-3 px-4 text-right">Receivables (USD)</th>
                <th className="py-3 px-4 text-right">Payables (USD)</th>
                <th className="py-3 px-4 text-right">Cash Reserves</th>
                <th className="py-3 px-4 text-right">Net Volume (KG)</th>
                <th className="py-3 px-4 text-right">Trading Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {companies.map((c: any) => (
                <tr key={c.company_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-4 font-sans font-bold flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color_accent }} />
                    <span className="text-slate-900 dark:text-white">{c.company_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({c.company_code})</span>
                  </td>
                  <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-400">{c.country}</td>
                  <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{c.invoices_count}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                    ${c.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-blue-600 dark:text-blue-400 font-semibold">
                    ${c.receivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400 font-semibold">
                    ${c.payables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-sky-600 dark:text-sky-400 font-semibold">
                    ${c.cash_position.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                    {c.net_kg.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    ${c.known_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {/* Group Total Row */}
              <tr className="bg-slate-100/90 dark:bg-slate-800/80 font-bold border-t-2 border-b-2 border-slate-300 dark:border-slate-700 text-xs">
                <td colSpan={2} className="py-3 px-4 font-sans uppercase tracking-wider text-slate-900 dark:text-white">
                  GROUP CONSOLIDATED TOTAL
                </td>
                <td className="py-3 px-4 text-right text-slate-900 dark:text-white">
                  {companies.reduce((sum: number, c: any) => sum + (c.invoices_count || 0), 0)}
                </td>
                <td className="py-3 px-4 text-right text-slate-900 dark:text-white font-black">
                  ${(kpis.total_group_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-right text-blue-600 dark:text-blue-400 font-black">
                  ${(kpis.total_group_receivables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400 font-black">
                  ${(kpis.total_group_payables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-right text-sky-600 dark:text-sky-400 font-black">
                  ${(kpis.total_group_cash || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-right text-slate-900 dark:text-white font-bold">
                  {(kpis.total_group_kg || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                </td>
                <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-black">
                  ${(kpis.total_group_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Navigation to Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/accounting/intercompany"
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 transition group shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 transition">
                Intercompany Ledger
              </div>
              <div className="text-[11px] text-slate-500">
                Due To / Due From pair-wise matrix & settlements
              </div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition" />
        </Link>

        <Link
          href="/accounting/consolidated/profit-loss"
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 transition group shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-sky-600 transition">
                Consolidated P&L
              </div>
              <div className="text-[11px] text-slate-500">
                Multi-column group revenue, COGS & net margins
              </div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition" />
        </Link>

        <Link
          href="/accounting/consolidated/balance-sheet"
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition group shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 transition">
                Consolidated Balance Sheet
              </div>
              <div className="text-[11px] text-slate-500">
                Eliminated intercompany loans & verified equality
              </div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition" />
        </Link>
      </div>
    </div>
  );
}
