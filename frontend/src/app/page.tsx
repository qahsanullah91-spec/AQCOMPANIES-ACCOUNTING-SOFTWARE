"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  Truck,
  Boxes,
  Users,
  Building2,
  Landmark,
  Ship,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CreditCard,
  ArrowLeftRight,
  Wallet,
  BookOpen,
  Calendar,
} from "lucide-react";
import { fetchApi, formatUSD, formatWeight, formatNumber, safeDecimal, safeString, formatCurrency } from "@/lib/api";
import { MobileWorkQueue } from "@/components/MobileWorkQueue";
import { ReceiveMoneyModal } from "@/components/ReceiveMoneyModal";

export default function DashboardPage() {
  const [filter, setFilter] = useState("this_month");
  const [data, setData] = useState<any>(null);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [bankSummary, setBankSummary] = useState<any>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [activeCompany, setActiveCompany] = useState("AQ COMPANIES");
  const [receiveMoneyOpen, setReceiveMoneyOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAllMobileMetrics, setShowAllMobileMetrics] = useState(false);

  // Time-aware greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const currentDateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCompany = localStorage.getItem("aq_active_company");
      if (savedCompany) {
        try {
          const parsed = JSON.parse(savedCompany);
          setActiveCompany(parsed.company_name || parsed);
        } catch {
          setActiveCompany(savedCompany);
        }
      }

      const handleCompanyChange = (e: any) => {
        if (e.detail?.company_name) {
          setActiveCompany(e.detail.company_name);
        }
      };

      window.addEventListener("aq_company_changed", handleCompanyChange);
      return () => window.removeEventListener("aq_company_changed", handleCompanyChange);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [res, dailyRes, bankRes, appRes] = await Promise.all([
          fetchApi<any>(`/dashboard/kpis?filter=${filter}`),
          fetchApi<any>(`/accounting/daily-summary`).catch(() => null),
          fetchApi<any>(`/accounting/banks/summary`).catch(() => null),
          fetchApi<any>(`/accounting/approvals?status=PENDING`).catch(() => []),
        ]);
        setData(res);
        if (dailyRes) setDailySummary(dailyRes);
        if (bankRes) setBankSummary(bankRes);
        if (Array.isArray(appRes)) setPendingApprovalsCount(appRes.length);
      } catch (err) {
        console.error("Failed to load dashboard KPIs:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [filter]);

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};

  // Computed values
  const bankBalance = (kpis.total_bank_money_in || 0) - (kpis.total_bank_money_out || 0);
  const cashBalance = bankSummary?.accounts
    ?.filter((a: any) => a.account_type === "CASH")
    ?.reduce((sum: number, a: any) => sum + (a.current_balance || 0), 0) || 0;
  const unreconciledBankCount = bankSummary?.reconciliation_summary?.unreconciled || 0;
  const transportBalance = kpis.transport_company_balance || 0;
  const isTransportCreditInOurFavor = transportBalance < 0;
  const transportCreditAmount = isTransportCreditInOurFavor ? Math.abs(transportBalance) : 0;
  const hasPendingCost = kpis.pending_purchases_count > 0 || kpis.profit_status !== "CALCULATED";

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Financial & Logistics Dashboard
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Trading • Logistics • Accounting
          </p>
        </div>

        {/* Time Filter Bar (Horizontally scrollable on iPhone) */}
        <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-2xs overflow-x-auto no-scrollbar">
          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "this_week", label: "This Week" },
            { id: "this_month", label: "This Month" },
            { id: "this_year", label: "This Year" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 min-h-[36px] ${
                filter === tab.id
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================
          REQUIREMENT 29: Prominent Purchase Cost Warning Banner
          Visible on all screen sizes, highly noticeable on mobile
          ========================================================= */}
      {hasPendingCost && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex flex-wrap items-center gap-2">
              <span>PURCHASE COST PENDING</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 hidden sm:inline" />
              <span className="text-amber-700 dark:text-amber-400">PROFIT INCOMPLETE</span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-800/90 dark:text-amber-300/90 font-medium mt-1 leading-relaxed">
              Waiting for Afghanistan supplier rates on{" "}
              <strong>{kpis.pending_purchases_count || 1} purchase order(s)</strong>. Stated net profit is provisional until supplier rate agreements are finalized.
            </p>
          </div>
        </div>
      )}

      {/* =========================================================
          SECTION 1, 2, 3, 5, 6: IPHONE FINANCIAL COMMAND CENTER (< lg)
          ========================================================= */}
      <div className="lg:hidden space-y-4">
        {/* Mobile Greeting & Company Bar (Req 1) */}
        <div className="flex items-center justify-between pb-0.5 px-0.5">
          <div>
            <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              {greeting} • {currentDateStr}
            </div>
            <div className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
              <span>{activeCompany}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
            </div>
          </div>
          <Link
            href="/approvals"
            className="px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-[11px] font-bold flex items-center gap-1"
          >
            <span>Approvals</span>
            {pendingApprovalsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[9px] flex items-center justify-center font-black">
                {pendingApprovalsCount}
              </span>
            )}
          </Link>
        </div>

        {/* Mobile Quick Action Buttons (Req 6) - 6 Prominent Touch Actions */}
        <div className="grid grid-cols-3 gap-2">
          {/* 1. Receive Money */}
          <button
            type="button"
            onClick={() => setReceiveMoneyOpen(true)}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all min-h-[58px]"
          >
            <CreditCard className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] font-black tracking-tight leading-tight">Receive Money</span>
          </button>

          {/* 2. Pay Supplier */}
          <Link
            href="/payables"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 active:scale-95 transition-all min-h-[58px]"
          >
            <Building2 className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] font-black tracking-tight leading-tight">Pay Supplier</span>
          </Link>

          {/* 3. Pay Transport */}
          <Link
            href="/transport/account"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20 active:scale-95 transition-all min-h-[58px]"
          >
            <Truck className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] font-black tracking-tight leading-tight">Pay Transport</span>
          </Link>

          {/* 4. Record Expense */}
          <Link
            href="/expenses"
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 active:scale-95 transition-all min-h-[48px]"
          >
            <Wallet className="w-4 h-4 text-purple-500 mb-0.5" />
            <span className="text-[10px] font-bold">Expense</span>
          </Link>

          {/* 5. Transfer */}
          <Link
            href="/banking/transactions"
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 active:scale-95 transition-all min-h-[48px]"
          >
            <ArrowLeftRight className="w-4 h-4 text-blue-500 mb-0.5" />
            <span className="text-[10px] font-bold">Transfer</span>
          </Link>

          {/* 6. Journal */}
          <Link
            href="/accounting/daily"
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 active:scale-95 transition-all min-h-[48px]"
          >
            <BookOpen className="w-4 h-4 text-indigo-500 mb-0.5" />
            <span className="text-[10px] font-bold">Journal</span>
          </Link>
        </div>

        {/* =========================================================
            SECTION 7 & 8: ABOVE-THE-FOLD PRIORITY FINANCIAL CARDS (< lg)
            1. Bank Balance, 2. Customer Receivables, 3. Money In Today,
            4. Money Out Today, 5. Pending Approvals
            Compact card style with tabular numbers and [ View ] action
            ========================================================= */}
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            Financial Command Center
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {/* 1. BANK BALANCE */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Bank Balance
                </div>
                <div className="text-base sm:text-lg font-black font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5 break-words">
                  {formatUSD(bankBalance)}
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  Central & Trading Banks
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href="/banking"
                  className="inline-flex items-center justify-center w-full py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[10px] font-bold min-h-[32px] transition-colors"
                >
                  View
                </Link>
              </div>
            </div>

            {/* 2. CUSTOMER RECEIVABLES */}
            <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 rounded-2xl p-3 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Customer Receivables
                </div>
                <div className="text-base sm:text-lg font-black font-mono tabular-nums text-rose-700 dark:text-rose-300 mt-0.5 break-words">
                  {formatUSD(kpis.customer_receivable)}
                </div>
                <div className="text-[10px] text-rose-600 dark:text-rose-400 truncate mt-0.5">
                  Open invoices: {kpis.unpaid_invoices || 57}
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href="/receivables"
                  className="inline-flex items-center justify-center w-full py-1 px-2 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 text-[10px] font-bold min-h-[32px] transition-colors"
                >
                  View
                </Link>
              </div>
            </div>

            {/* 3. MONEY IN TODAY */}
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl p-3 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Money In Today
                </div>
                <div className="text-base sm:text-lg font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-300 mt-0.5 break-words">
                  +{formatUSD(dailySummary?.customer_money_received || 0)}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                  Receipts & Collections
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href="/accounting/daily"
                  className="inline-flex items-center justify-center w-full py-1 px-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold min-h-[32px] transition-colors"
                >
                  View
                </Link>
              </div>
            </div>

            {/* 4. MONEY OUT TODAY */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Money Out Today
                </div>
                <div className="text-base sm:text-lg font-black font-mono tabular-nums text-slate-800 dark:text-slate-200 mt-0.5 break-words">
                  -{formatUSD(
                    (dailySummary?.supplier_payments || 0) +
                    (dailySummary?.transport_payments || 0) +
                    (dailySummary?.expenses || 0) +
                    (dailySummary?.bank_charges || 0)
                  )}
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  Payments & Overheads
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href="/accounting/daily"
                  className="inline-flex items-center justify-center w-full py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[10px] font-bold min-h-[32px] transition-colors"
                >
                  View
                </Link>
              </div>
            </div>
          </div>

          {/* 5. PENDING APPROVALS (Spans full width above fold) */}
          <div className="bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 rounded-2xl p-3 shadow-2xs flex items-center justify-between gap-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
                Pending Approvals
              </div>
              <div className="text-base font-black font-mono tabular-nums text-purple-800 dark:text-purple-300 mt-0.5">
                {pendingApprovalsCount} Items Pending Release
              </div>
              <div className="text-[10px] text-purple-600 dark:text-purple-400">
                Four-Eyes Policy Dual-Control Authorization
              </div>
            </div>
            <Link
              href="/approvals"
              className="py-1.5 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shrink-0 min-h-[36px] flex items-center shadow-xs"
            >
              Review
            </Link>
          </div>
        </div>

        {/* =========================================================
            SECTION 7 (CONTINUED): SECONDARY COMMAND CENTER
            Transport Credit, Supplier Payables, Accounting Alerts
            ========================================================= */}
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            Operational Liabilities & Carrier Position
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {/* TRANSPORT CREDIT */}
            <div className="bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/40 rounded-2xl p-3 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-400">
                  Transport Credit
                </div>
                <div className="text-base sm:text-lg font-black font-mono tabular-nums text-teal-700 dark:text-teal-300 mt-0.5 break-words">
                  {formatUSD(transportCreditAmount)}
                </div>
                <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 truncate mt-0.5">
                  CREDIT IN OUR FAVOR
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href="/transport/account"
                  className="inline-flex items-center justify-center w-full py-1 px-2 rounded-lg bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-[10px] font-bold min-h-[32px] transition-colors"
                >
                  View
                </Link>
              </div>
            </div>

            {/* SUPPLIER PAYABLES */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Supplier Payables
                </div>
                <div className="text-base sm:text-lg font-black font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5 break-words">
                  {formatUSD(kpis.supplier_payable)}
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  Due to Sellers (Pending Rates)
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href="/payables"
                  className="inline-flex items-center justify-center w-full py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[10px] font-bold min-h-[32px] transition-colors"
                >
                  View
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ACCOUNTING ALERTS WORK QUEUE (Req 4, 7) */}
        <MobileWorkQueue />

        {/* =========================================================
            SECTION 3: TODAY SECTION (Req 3)
            Customer Receipts Today, Supplier Payments Today, Transport Payments Today,
            Expenses Today, Bank Charges Today, Net Cash Movement Today
            ========================================================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Today — Cash Movement Summary
              </h2>
            </div>
            <Link
              href="/accounting/daily"
              className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5"
            >
              <span>Ledger</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="p-4 space-y-2.5 text-xs font-mono">
            {/* Receipts Today */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 font-sans">Customer Receipts Today</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{formatUSD(dailySummary?.customer_money_received || 0)}
              </span>
            </div>

            {/* Supplier Payments Today */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 font-sans">Supplier Payments Today</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                -{formatUSD(dailySummary?.supplier_payments || 0)}
              </span>
            </div>

            {/* Transport Payments Today */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 font-sans">Transport Payments Today</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                -{formatUSD(dailySummary?.transport_payments || 0)}
              </span>
            </div>

            {/* Expenses Today */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 font-sans">Operating Expenses Today</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                -{formatUSD(dailySummary?.expenses || 0)}
              </span>
            </div>

            {/* Bank Charges Today */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-500 font-sans">Bank Fees & Charges</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                -{formatUSD(dailySummary?.bank_charges || 0)}
              </span>
            </div>

            {/* Net Movement Today */}
            <div className="flex items-center justify-between pt-1 font-bold">
              <span className="text-slate-700 dark:text-slate-300 font-sans">Net Cash Movement Today</span>
              <span
                className={`text-sm font-black tabular-nums ${
                  (dailySummary?.net_cash_movement || 0) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {(dailySummary?.net_cash_movement || 0) >= 0 ? "+" : ""}
                {formatUSD(dailySummary?.net_cash_movement || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================
            SECTION 43: MOBILE RECENT ACTIVITY CARDS
            Customer Receipt, Supplier Payment, Transport Payment,
            Expense, Bank Match, Journal. (type, party, amount, time, status)
            ========================================================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Recent Accounting Activity
            </h2>
            <Link
              href="/accounting/general-ledger"
              className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
            >
              All Entries
            </Link>
          </div>

          <div className="p-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {/* 1. Customer Receipt */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    Receipt
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    Manocha Enterprises
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  CR-2026-0041 • Today 11:30 AM
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-black text-emerald-600">+$30,000.00</div>
                <span className="text-[9px] font-bold text-slate-400 uppercase">POSTED</span>
              </div>
            </div>

            {/* 2. Transport Payment */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                    Transport
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    Sky Ariana Transport
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  WIRE-9921 • Today 10:15 AM
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-black text-slate-900 dark:text-slate-100">-$25,000.00</div>
                <span className="text-[9px] font-bold text-teal-600 uppercase">IN CREDIT</span>
              </div>
            </div>

            {/* 3. Supplier Payment */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300">
                    Supplier
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    Haji Noorullah Ltd
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  SP-2026-0082 • Yesterday
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-black text-slate-900 dark:text-slate-100">-$40,000.00</div>
                <span className="text-[9px] font-bold text-slate-400 uppercase">SETTLED</span>
              </div>
            </div>

            {/* 4. Operating Expense */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                    Expense
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    Port Handling & Customs
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  EX-2026-0104 • 25 Sep
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-black text-slate-900 dark:text-slate-100">-$1,450.00</div>
                <span className="text-[9px] font-bold text-slate-400 uppercase">AUDITED</span>
              </div>
            </div>

            {/* 5. Bank Match */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                    Bank Match
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    Emirates NBD USD Central
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  REC-2026-003 • 25 Sep
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-black text-emerald-600">Matched</div>
                <span className="text-[9px] font-bold text-emerald-600 uppercase">RECONCILED</span>
              </div>
            </div>

            {/* 6. General Journal */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                    Journal
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    Monthly Currency Revaluation
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  JV-2026-00456 • 24 Sep
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-black text-slate-900 dark:text-slate-100">Balanced</div>
                <span className="text-[9px] font-bold text-indigo-600 uppercase">POSTED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Direct Fast Modal: Receive Customer Money */}
        <ReceiveMoneyModal
          isOpen={receiveMoneyOpen}
          onClose={() => setReceiveMoneyOpen(false)}
        />

        {/* Expandable Section for Operations & Logistics (Mobile) */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAllMobileMetrics(!showAllMobileMetrics)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-300 min-h-[44px]"
          >
            <span>{showAllMobileMetrics ? "Hide Logistics & Operations" : "Show All Operational Metrics"}</span>
            {showAllMobileMetrics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAllMobileMetrics && (
            <div className="grid grid-cols-2 gap-2.5 pt-3 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Total Net Weight</div>
                <div className="text-sm font-black text-slate-900 dark:text-white mt-1">
                  {formatWeight(kpis.total_net_kg)}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Total Containers</div>
                <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1">
                  {kpis.total_containers || 0} HQ Units
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Active Shipments</div>
                <div className="text-sm font-black text-sky-600 mt-1">{kpis.active_shipments || 0}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Unpaid Invoices</div>
                <div className="text-sm font-black text-rose-600 mt-1">{kpis.unpaid_invoices || 0}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================
          DESKTOP 24-CARD GRID (>= lg: 100% UNCHANGED DESKTOP WORKFLOW)
          ========================================================= */}
      <div className="hidden lg:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
        {/* 1. TOTAL SALES */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sales</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatUSD(kpis.total_sales)}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center">
            <ArrowUpRight className="w-3 h-3 mr-0.5" /> Gross Revenue
          </div>
        </div>

        {/* 2. TOTAL PURCHASE COST */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Cost</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {kpis.pending_purchases_count > 0 && Number(kpis.total_purchase_cost) === 0 ? (
              <span className="text-amber-500 dark:text-amber-400 text-sm font-bold flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 shrink-0" /> Pending Rates
              </span>
            ) : (
              formatUSD(kpis.total_purchase_cost)
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">
            {kpis.pending_purchases_count > 0 ? `${kpis.pending_purchases_count} POs Awaiting Rates` : "Afghanistan Origin Cost"}
          </div>
        </div>

        {/* 3. TOTAL TRANSPORT COST */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transport Cost</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatUSD(kpis.total_transport_cost)}
          </div>
          <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium mt-1">Freight & Trucking</div>
        </div>

        {/* 4. OTHER EXPENSES */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Other Expenses</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatUSD(kpis.total_other_expenses)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Customs, Docs, Bank</div>
        </div>

        {/* 5. TOTAL BUSINESS COST */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Business Cost</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatUSD(kpis.total_business_cost)}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">All Expenses Combined</div>
        </div>

        {/* 6. NET PROFIT */}
        <div
          className={`rounded-xl p-4 shadow-2xs border transition-all ${
            kpis.net_profit !== null && kpis.profit_status === "CALCULATED"
              ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
              : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50"
          }`}
        >
          <div
            className={`text-[10px] font-bold uppercase tracking-wider ${
              kpis.net_profit !== null && kpis.profit_status === "CALCULATED"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-amber-700 dark:text-amber-400"
            }`}
          >
            Net Profit
          </div>
          <div
            className={`text-lg font-black mt-1 ${
              kpis.net_profit !== null && kpis.profit_status === "CALCULATED"
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-amber-600 dark:text-amber-400 text-sm flex items-center"
            }`}
          >
            {kpis.net_profit !== null && kpis.profit_status === "CALCULATED" ? (
              formatUSD(kpis.net_profit)
            ) : (
              <span className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 shrink-0" /> Pending Cost
              </span>
            )}
          </div>
          <div
            className={`text-[10px] font-semibold mt-1 flex items-center ${
              kpis.net_profit !== null && kpis.profit_status === "CALCULATED"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {kpis.net_profit !== null && kpis.profit_status === "CALCULATED"
              ? `${kpis.profit_margin_pct || 0}% Margin`
              : "Awaiting Supplier Rates"}
          </div>
        </div>

        {/* 7. CUSTOMER MONEY RECEIVED */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Received</div>
          <div className="text-lg font-black text-emerald-600 mt-1">
            {formatUSD(kpis.customer_money_received)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Bank Settlements</div>
        </div>

        {/* 8. CUSTOMER RECEIVABLE */}
        <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            Customer Receivable
          </div>
          <div className="text-lg font-black text-rose-700 dark:text-rose-300 mt-1">
            {formatUSD(kpis.customer_receivable)}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-1">Total Outstanding Due</div>
        </div>

        {/* 9. SUPPLIER PAYABLE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier Payable</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatUSD(kpis.supplier_payable)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Due to Sellers</div>
        </div>

        {/* 10. TRANSPORT CHARGES */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transport Charges</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatUSD(kpis.transport_company_charges)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Logistics Incurred</div>
        </div>

        {/* 11. TRANSPORT PAYMENTS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transport Paid</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatUSD(kpis.transport_company_payments)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Paid to Transporters</div>
        </div>

        {/* 12. TRANSPORT BALANCE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transport Balance</div>
          <div
            className={`text-lg font-black mt-1 ${
              (kpis.transport_company_balance || 0) < 0 ? "text-sky-600" : "text-amber-600"
            }`}
          >
            {formatUSD(kpis.transport_company_balance)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">
            {(kpis.transport_company_balance || 0) < 0 ? "Credit in our favor" : "Payable to transport"}
          </div>
        </div>

        {/* 13. BANK MONEY IN */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Money In</div>
          <div className="text-lg font-black text-emerald-600 mt-1">
            {formatUSD(kpis.total_bank_money_in)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Total Collections</div>
        </div>

        {/* 14. BANK MONEY OUT */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Money Out</div>
          <div className="text-lg font-black text-rose-600 mt-1">
            {formatUSD(kpis.total_bank_money_out)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Total Disbursements</div>
        </div>

        {/* 15. STOCK VALUE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Stock Value</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatUSD(kpis.total_stock_value)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Unallocated/Ready Stock</div>
        </div>

        {/* 16. TOTAL NET KG */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Net Weight</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatWeight(kpis.total_net_kg)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Shipped Dry Fruit</div>
        </div>

        {/* 17. TOTAL CARTONS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cartons</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatNumber(kpis.total_cartons)} CTNS
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Boxes Shipped</div>
        </div>

        {/* 18. TOTAL CONTAINERS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Containers</div>
          <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {kpis.total_containers || 0} HQ
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">40ft Marine Units</div>
        </div>

        {/* 19. ACTIVE SHIPMENTS */}
        <div className="bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/50 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
            Active Shipments
          </div>
          <div className="text-lg font-black text-sky-700 dark:text-sky-300 mt-1">
            {kpis.active_shipments || 0}
          </div>
          <div className="text-[10px] text-sky-600 font-medium mt-1">In Transit / Border</div>
        </div>

        {/* 20. DELIVERED SHIPMENTS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivered</div>
          <div className="text-lg font-black text-emerald-600 mt-1">
            {kpis.delivered_shipments || 0}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Customs Cleared in India</div>
        </div>

        {/* 21. PAID INVOICES */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid Invoices</div>
          <div className="text-lg font-black text-emerald-600 mt-1">{kpis.paid_invoices || 0}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">100% Settled</div>
        </div>

        {/* 22. PARTIALLY PAID INVOICES */}
        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            Partially Paid
          </div>
          <div className="text-lg font-black text-amber-700 dark:text-amber-300 mt-1">
            {kpis.partially_paid_invoices || 0}
          </div>
          <div className="text-[10px] text-amber-600 font-medium mt-1">Partial Bank Receipt</div>
        </div>

        {/* 23. UNPAID INVOICES */}
        <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            Unpaid Invoices
          </div>
          <div className="text-lg font-black text-rose-700 dark:text-rose-300 mt-1">
            {kpis.unpaid_invoices || 0}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-1">Awaiting Remittance</div>
        </div>

        {/* 24. PROFIT MARGIN % */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Profit Margin</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {kpis.profit_margin_pct !== null && kpis.profit_status === "CALCULATED" ? `${kpis.profit_margin_pct}%` : "—"}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">
            {kpis.profit_margin_pct !== null && kpis.profit_status === "CALCULATED" ? "Net ROI on Turnover" : "Pending Cost Data"}
          </div>
        </div>
      </div>

      {/* Visual Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Monthly Revenue vs Profit */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Monthly Financial Performance</h2>
              <p className="text-[11px] text-slate-400">Sales vs Purchase Cost vs Real Profit</p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center text-sky-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 mr-1.5"></span> Sales
              </span>
              <span className="flex items-center text-emerald-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5"></span> Net Profit
              </span>
            </div>
          </div>

          <div className="h-56 sm:h-60 flex items-end justify-between gap-2 sm:gap-4 pt-6 pb-2 px-1 sm:px-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
            {(!charts.monthly_financials || charts.monthly_financials.length === 0) ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 italic">
                No monthly performance data available
              </div>
            ) : (
              charts.monthly_financials.map((m: any, idx: number) => {
                const salesNum = safeDecimal(m?.sales, 0);
                const profitNum = safeDecimal(m?.profit, 0);
                const maxVal = Math.max(
                  ...(charts.monthly_financials || []).map((x: any) => safeDecimal(x?.sales, 0)),
                  1000
                );
                const salesH = maxVal > 0 ? Math.min(100, Math.max(4, Math.round((salesNum / maxVal) * 100))) : 4;
                const profitH = maxVal > 0 ? Math.min(100, Math.max(2, Math.round((profitNum / maxVal) * 100))) : 2;
                const monthLabel = safeString(m?.month).split(" ")[0] || `M${idx + 1}`;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group min-w-[36px]">
                    <div className="w-full flex items-end justify-center space-x-1 sm:space-x-1.5 h-40 sm:h-44">
                      <div
                        style={{ height: `${salesH}%` }}
                        className="w-1/2 bg-sky-500 rounded-t-sm group-hover:bg-sky-400 transition-all relative"
                        title={`Sales: ${formatUSD(salesNum)}`}
                      ></div>
                      <div
                        style={{ height: `${profitH}%` }}
                        className="w-1/2 bg-emerald-500 rounded-t-sm group-hover:bg-emerald-400 transition-all relative"
                        title={`Profit: ${formatUSD(profitNum)}`}
                      ></div>
                    </div>
                    <div className="text-[10px] font-semibold text-slate-400 mt-2 truncate w-full text-center">
                      {monthLabel}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sales by Customer & Receivables */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Customer Sales & Receivables</h2>
              <p className="text-[11px] text-slate-400">Total volume and outstanding balance by buyer</p>
            </div>
            <Link href="/customers" className="text-xs text-sky-600 hover:text-sky-500 font-semibold">
              View All Ledgers →
            </Link>
          </div>

          <div className="space-y-4">
            {(!charts.sales_by_customer || charts.sales_by_customer.length === 0) ? (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                No customer sales or receivables recorded
              </div>
            ) : (
              charts.sales_by_customer.slice(0, 4).map((c: any, idx: number) => {
                const cVal = safeDecimal(c?.value, 0);
                const recItem = (charts.customer_receivables || []).find((r: any) => r?.name === c?.name);
                const recVal = safeDecimal(recItem?.value, 0);
                const paidPct = cVal > 0 ? Math.max(0, Math.min(100, Math.round(((cVal - recVal) / cVal) * 100))) : 0;
                const duePct = cVal > 0 ? Math.max(0, Math.min(100, Math.round((recVal / cVal) * 100))) : 0;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800 dark:text-slate-200 truncate pr-2">{c?.name || "Customer"}</span>
                      <div className="space-x-2 shrink-0">
                        <span className="text-slate-900 dark:text-slate-100">{formatUSD(cVal)}</span>
                        {recVal > 0 && (
                          <span className="text-rose-600 font-bold">Due: {formatUSD(recVal)}</span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                      <div
                        style={{ width: `${paidPct}%` }}
                        className="bg-emerald-500 h-full"
                        title={`Paid portion: ${paidPct}%`}
                      ></div>
                      <div
                        style={{ width: `${duePct}%` }}
                        className="bg-rose-500 h-full"
                        title={`Outstanding due: ${duePct}%`}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Link
          href="/shipments"
          className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500/50 hover:shadow-xs transition-all flex items-center space-x-3.5 group min-h-[52px]"
        >
          <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center shrink-0">
            <Ship className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600">
              Master Shipment Ledger
            </div>
            <div className="text-[11px] text-slate-500">View & edit container shipments</div>
          </div>
        </Link>

        <Link
          href="/new-stock"
          className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/50 hover:shadow-xs transition-all flex items-center space-x-3.5 group min-h-[52px]"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600">
              New Stock Module
            </div>
            <div className="text-[11px] text-slate-500">Pre-shipment stock & conversion</div>
          </div>
        </Link>

        <Link
          href="/transport"
          className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-500/50 hover:shadow-xs transition-all flex items-center space-x-3.5 group min-h-[52px]"
        >
          <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-orange-600">
              Transport Ledger
            </div>
            <div className="text-[11px] text-slate-500">Freight balances & company credit</div>
          </div>
        </Link>

        <Link
          href="/profit-and-loss"
          className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500/50 hover:shadow-xs transition-all flex items-center space-x-3.5 group min-h-[52px]"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600">
              Profit & Loss
            </div>
            <div className="text-[11px] text-slate-500">COGS, margins & net income</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
