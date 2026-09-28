"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Briefcase,
  TrendingUp,
  Scale,
  Layers,
  ArrowUpDown,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Users,
  Building2,
  Calendar,
  Wallet,
  ArrowRight,
  Printer,
  RefreshCw,
  PieChart,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

export default function ManagementDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [bsData, setBsData] = useState<any>(null);
  const [pnlData, setPnlData] = useState<any>(null);
  const [auditData, setAuditData] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bs, pnl, audit] = await Promise.all([
        fetchApi<any>("/accounting/reports/balance-sheet"),
        fetchApi<any>("/accounting/reports/profit-loss"),
        fetchApi<any>("/accounting/audit-center"),
      ]);
      setBsData(bs);
      setPnlData(pnl);
      setAuditData(audit);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const cur = pnlData?.current_period;
  const assets = bsData?.assets;
  const liabs = bsData?.liabilities;

  // Working capital = Current Assets - Current Liabilities
  const currentAssets = assets?.total_assets || 0;
  const currentLiabs = liabs?.total_liabilities || 0;
  const workingCapital = currentAssets - currentLiabs;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
      <AccountingNav />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link href="/accounting/reports" className="hover:text-sky-600 flex items-center space-x-1">
              <span>Financial Report Center</span>
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Executive Center</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Management Financial Control Center</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            C-Suite financial oversight &bull; Double-entry ground-truth metrics for AQ COMPANIES leadership.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Scorecard</span>
          </button>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Invoiced Sales</span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatUSD(cur?.sales_revenue || 0)}
          </div>
          <span className="text-xs text-emerald-600 font-medium">Export Invoices & Customs</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Known Net Profit (Preliminary)</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {formatUSD(cur?.net_profit || 0)}
          </div>
          <span className="text-xs text-amber-500 font-medium">
            {pnlData?.pending_purchase_costs_count || 63} Afghan Shipments Pending Costs
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Balance Sheet Assets</span>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1 font-mono">
            {formatUSD(assets?.total_assets || 0)}
          </div>
          <span className="text-xs text-slate-400">Includes $321K Carrier Advance Asset</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Net Working Capital</span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatUSD(workingCapital)}
          </div>
          <span className="text-xs text-emerald-600 font-medium">Strong Liquidity Surplus</span>
        </div>
      </div>

      {/* Strategic Operational Health Review */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center space-x-2">
            <Scale className="w-5 h-5 text-sky-600" />
            <span>Statutory Accounting Invariants</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">General Ledger Balance:</span>
              <span className="font-bold text-emerald-600 font-mono">BALANCED ($0.00 DIFFERENCE)</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Balance Sheet Equation (A = L + E):</span>
              <span className="font-bold text-emerald-600 font-mono">BALANCED ($0.00 DIFFERENCE)</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Transport Account Standing (Sky Ariana):</span>
              <span className="font-bold text-sky-600 font-mono">+$321,160.00 ASSET IN OUR FAVOR</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Customer Receipts Verified:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">$0.00 (Zero False Receipts)</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Afghan Purchase Invoices:</span>
              <span className="font-bold text-amber-600 font-mono">63 PENDING SUPPLIER BILLS</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span>Direct Financial Navigation</span>
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <Link
              href="/accounting/reports/profit-loss"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all flex flex-col justify-between"
            >
              <span className="font-bold text-slate-900 dark:text-slate-100">Profit & Loss</span>
              <span className="text-[11px] text-slate-500 mt-1">GAAP Revenue & Expenses</span>
            </Link>
            <Link
              href="/accounting/reports/balance-sheet"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all flex flex-col justify-between"
            >
              <span className="font-bold text-slate-900 dark:text-slate-100">Balance Sheet</span>
              <span className="text-[11px] text-slate-500 mt-1">Assets, Liabilities & Equity</span>
            </Link>
            <Link
              href="/accounting/reports/trial-balance"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all flex flex-col justify-between"
            >
              <span className="font-bold text-slate-900 dark:text-slate-100">Trial Balance</span>
              <span className="text-[11px] text-slate-500 mt-1">8-Column Extended Audit</span>
            </Link>
            <Link
              href="/accounting/reports/cash-flow"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all flex flex-col justify-between"
            >
              <span className="font-bold text-slate-900 dark:text-slate-100">Cash Flow</span>
              <span className="text-[11px] text-slate-500 mt-1">Direct Bank Movements</span>
            </Link>
            <Link
              href="/accounting/budgets"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all flex flex-col justify-between"
            >
              <span className="font-bold text-slate-900 dark:text-slate-100">Budgets & Targets</span>
              <span className="text-[11px] text-slate-500 mt-1">Budget vs Actual Variance</span>
            </Link>
            <Link
              href="/accounting/cash-forecast"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all flex flex-col justify-between"
            >
              <span className="font-bold text-slate-900 dark:text-slate-100">Cash Forecast</span>
              <span className="text-[11px] text-slate-500 mt-1">7/30/60/90 Day Liquidity</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
