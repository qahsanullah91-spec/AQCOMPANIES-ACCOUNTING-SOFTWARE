"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Scale,
  Layers,
  ArrowUpDown,
  Users,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileText,
  BarChart3,
  Target,
  ShieldAlert,
  ArrowRight,
  Clock,
  Printer,
  RefreshCw,
  Wallet,
  Briefcase,
  Lock,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

interface HealthSummary {
  trial_balance_difference: number;
  is_tb_balanced: boolean;
  total_sales_invoiced: number;
  total_ar_outstanding: number;
  total_carrier_advance_asset: number;
  pending_purchase_shipments_count: number;
}

export default function FinancialReportsHubPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tbData, setTbData] = useState<any>(null);
  const [bsData, setBsData] = useState<any>(null);
  const [pnlData, setPnlData] = useState<any>(null);

  const loadReportMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tb, bs, pnl] = await Promise.all([
        fetchApi<any>("/accounting/reports/trial-balance"),
        fetchApi<any>("/accounting/reports/balance-sheet"),
        fetchApi<any>("/accounting/reports/profit-loss"),
      ]);
      setTbData(tb);
      setBsData(bs);
      setPnlData(pnl);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load financial reporting summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportMetrics();
  }, []);

  const reportCards = [
    {
      title: "Profit & Loss Statement",
      description: "GAAP-compliant revenue, direct shipment costs, opex, and preliminary Afghan purchase cost protection.",
      href: "/accounting/reports/profit-loss",
      icon: TrendingUp,
      badge: pnlData?.status || "GAAP Preliminary",
      badgeColor: pnlData?.is_profit_complete ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      primaryMetric: formatUSD(pnlData?.current_period?.net_profit || 0),
      metricLabel: "Known Net Profit",
      secondaryMetric: `${pnlData?.pending_purchase_costs_count || 0} Pending Costs`,
    },
    {
      title: "Balance Sheet",
      description: "Assets, liabilities, equity. Strictly classifies Transport Advance ($321,160.00) under Assets.",
      href: "/accounting/reports/balance-sheet",
      icon: Scale,
      badge: bsData?.is_balanced ? "Balanced ($0.00 Diff)" : "Discrepancy",
      badgeColor: bsData?.is_balanced ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
      primaryMetric: formatUSD(bsData?.assets?.total_assets || 0),
      metricLabel: "Total Assets",
      secondaryMetric: `Liabilities & Eq: ${formatUSD(bsData?.total_liabilities_and_equity || 0)}`,
    },
    {
      title: "8-Column Trial Balance",
      description: "Opening Dr/Cr, Period Dr/Cr, and Closing Dr/Cr with exact mathematical verification.",
      href: "/accounting/reports/trial-balance",
      icon: Layers,
      badge: tbData?.totals?.is_balanced ? "Balanced ($0.00 Diff)" : "Out of Balance",
      badgeColor: tbData?.totals?.is_balanced ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
      primaryMetric: formatUSD(tbData?.totals?.closing_debit || 0),
      metricLabel: "Total Dr / Cr",
      secondaryMetric: `Diff: ${formatUSD(tbData?.totals?.difference || 0)}`,
    },
    {
      title: "Cash Flow Statement",
      description: "Operating, investing, and financing direct cash movements verified against actual bank history.",
      href: "/accounting/reports/cash-flow",
      icon: ArrowUpDown,
      badge: "Direct Method",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
      primaryMetric: "Operating & Liquid",
      metricLabel: "Reconciled Flows",
      secondaryMetric: "Real-time Bank Data",
    },
    {
      title: "Customer Receivable Aging",
      description: "Current, 1-30, 31-60, 61-90, 91-120, and 120+ days aging buckets with invoice drilldown.",
      href: "/accounting/reports/receivable-aging",
      icon: Users,
      badge: "6 Aging Buckets",
      badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
      primaryMetric: formatUSD(4386655.66),
      metricLabel: "Invoiced Sales Base",
      secondaryMetric: "Detailed Overdue Ledger",
    },
    {
      title: "Supplier Payable Aging",
      description: "Confirmed supplier bills only. Excludes pending Afghan costs to prevent false numbers.",
      href: "/accounting/reports/payable-aging",
      icon: Building2,
      badge: "Confirmed Bills Only",
      badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
      primaryMetric: "Pending Supplier Bills",
      metricLabel: "Quarantine Center",
      secondaryMetric: "63 Pending Purchases",
    },
    {
      title: "Profitability Analytics",
      description: "Margin analysis by Customer, by Shipment Container, and calculated Profit per KG.",
      href: "/accounting/reports/profit-analysis",
      icon: BarChart3,
      badge: "Shipment & KG Level",
      badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
      primaryMetric: "Profit / KG",
      metricLabel: "Unit Economics",
      secondaryMetric: "Pending Cost Badges",
    },
    {
      title: "Monthly Financial Summary",
      description: "Multi-month chronological financial trends across Sales, Receipts, Transport, and Cash Flow.",
      href: "/accounting/reports/monthly-summary",
      icon: Calendar,
      badge: "FY 2026 Trend",
      badgeColor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
      primaryMetric: "12-Month Matrix",
      metricLabel: "Executive Review",
      secondaryMetric: "Chronological Breakdown",
    },
    {
      title: "Accounting Period Closing",
      description: "Pre-close verification checklist, immutable snapshot archive (SHA256), and admin reopening audit.",
      href: "/accounting/periods",
      icon: Lock,
      badge: "Period Lock & Audit",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      primaryMetric: "Period Checklists",
      metricLabel: "Immutable Snapshots",
      secondaryMetric: "SHA256 Cryptographic Lock",
    },
    {
      title: "Budgets & Variance Analysis",
      description: "Fiscal year budget allocations, actual GL performance comparisons, and variance % tracking.",
      href: "/accounting/budgets",
      icon: Target,
      badge: "Budget vs Actual",
      badgeColor: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
      primaryMetric: "Variance Reporting",
      metricLabel: "Financial Control",
      secondaryMetric: "Favorable / Unfavorable",
    },
    {
      title: "Cash Forecast & Planner",
      description: "7, 30, 60, and 90-day cash projections with probability-weighted receivables. Never alters GL.",
      href: "/accounting/cash-forecast",
      icon: TrendingUp,
      badge: "7 / 30 / 60 / 90 Days",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      primaryMetric: "Liquid Projections",
      metricLabel: "Weighted Receivables",
      secondaryMetric: "Safe Non-GL Planning",
    },
    {
      title: "Financial Audit Center",
      description: "Continuous risk monitoring: Large payments (> $25K), manual control entries, reversals, reopened periods.",
      href: "/accounting/audit",
      icon: ShieldAlert,
      badge: "Compliance Watchdog",
      badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
      primaryMetric: "High-Risk Alerts",
      metricLabel: "Control Account Audits",
      secondaryMetric: "Forensic Integrity",
    },
    {
      title: "Executive Management Center",
      description: "High-level KPI comparisons, working capital analysis, and financial health scorecard.",
      href: "/accounting/management",
      icon: Briefcase,
      badge: "C-Level View",
      badgeColor: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
      primaryMetric: "Executive Overview",
      metricLabel: "Decision Support",
      secondaryMetric: "Strategic Summary",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
      {/* Top Navigation */}
      <AccountingNav />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-sky-600 text-white rounded-xl shadow-md">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Financial Reporting & Control Center</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                AQ COMPANIES — Double-entry financial statements, period closing, budgets, forecasts & audit center.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadReportMetrics}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Statements</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Overview</span>
          </button>
        </div>
      </div>

      {/* Top Banner Integrity Checks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        {/* Trial Balance Health */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trial Balance</span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              tbData?.totals?.is_balanced
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
            }`}>
              {tbData?.totals?.is_balanced ? "BALANCED ($0.00 DIFF)" : "OUT OF BALANCE"}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {formatUSD(tbData?.totals?.closing_debit || 0)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Total Debits equal Total Credits across all general ledger accounts.
          </p>
        </div>

        {/* Balance Sheet Health */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance Sheet Eq.</span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              bsData?.is_balanced
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
            }`}>
              {bsData?.is_balanced ? "A = L + E VERIFIED" : "DISCREPANCY"}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {formatUSD(bsData?.assets?.total_assets || 0)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Includes $321,160.00 Transport Advance classified under Current Assets.
          </p>
        </div>

        {/* Afghan Purchase Costs Protection */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Afghan Purchases</span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {pnlData?.pending_purchase_costs_count || 63} PENDING INVOICES
            </span>
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
            PRELIMINARY PROFIT
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Incomplete shipments quarantined to prevent fabricated gross profit figures.
          </p>
        </div>
      </div>

      {/* Grid of Financial Reports */}
      <div className="my-6">
        <h2 className="text-lg font-bold mb-4 flex items-center space-x-2">
          <FileText className="w-5 h-5 text-sky-600" />
          <span>Financial Statements, Analytics & Audit Centers</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group flex flex-col justify-between p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500/50 dark:hover:border-sky-500/50 hover:shadow-lg transition-all"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {card.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">{card.metricLabel}</span>
                    <span className="text-slate-400">{card.secondaryMetric}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {card.primaryMetric}
                    </span>
                    <div className="flex items-center space-x-1 text-xs font-semibold text-sky-600 group-hover:translate-x-0.5 transition-transform">
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
