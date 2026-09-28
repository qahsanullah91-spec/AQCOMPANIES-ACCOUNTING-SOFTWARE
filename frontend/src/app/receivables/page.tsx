"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  CreditCard,
  Clock,
  AlertTriangle,
  Receipt,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ArrowDownRight,
  DollarSign,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { BankingNav } from "@/components/BankingNav";
import {
  PdfDownloadButton,
  PrintButton,
  MoneyDisplay,
} from "@/components/accounting";

interface InvoiceItem {
  invoice_id: number;
  invoice_number: string;
  date: string;
  amount: number;
  received: number;
  balance: number;
  days_outstanding: number;
  status: string;
}

interface CustomerAging {
  customer_id: number;
  customer_name: string;
  current_0_30: number;
  aging_31_60: number;
  aging_61_90: number;
  overdue_90_plus: number;
  total_outstanding: number;
  invoices: InvoiceItem[];
}

interface AgingReport {
  as_of_date: string;
  summary: {
    current_0_30: number;
    aging_31_60: number;
    aging_61_90: number;
    overdue_90_plus: number;
    total_receivable: number;
  };
  customers: CustomerAging[];
}

export default function CustomerReceivablesDashboardPage() {
  const [report, setReport] = useState<AgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedCustomerId, setExpandedCustomerId] = useState<number | null>(null);

  const loadAging = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi<AgingReport>("/accounting/receivables/aging");
      setReport(res);
      if (res && res.customers.length > 0 && expandedCustomerId === null) {
        setExpandedCustomerId(res.customers[0].customer_id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load receivables aging report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAging();
  }, []);

  const filteredCustomers = report?.customers.filter((c) =>
    c.customer_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider rounded-md uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              TRADE ASSETS
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Customer Receivables & Aging
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authoritative outstanding sales invoices and 4-tier aging analysis (0-30, 31-60, 61-90, 90+ days).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <PrintButton label="Print Aging" size="sm" />
          <button
            onClick={loadAging}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/receivables/payments"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Post Customer Receipt</span>
          </Link>
        </div>
      </div>

      <BankingNav />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* 4-Metric Mobile Top Summary (iPhone / mobile screens) */}
      <div className="grid grid-cols-2 gap-2.5 sm:hidden">
        {/* Outstanding */}
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Outstanding</div>
          <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
            {formatUSD(report?.summary.total_receivable ?? 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Across buyers</div>
        </div>

        {/* Overdue */}
        <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">Overdue (90+d)</div>
          <div className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5">
            {formatUSD(report?.summary.overdue_90_plus ?? 0)}
          </div>
          <div className="text-[10px] text-rose-700/80 dark:text-rose-400 mt-0.5">Action needed</div>
        </div>

        {/* Advances */}
        <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">Customer Advances</div>
          <div className="text-base font-black text-sky-600 dark:text-sky-400 mt-0.5">
            $0.00
          </div>
          <div className="text-[10px] text-sky-700/80 dark:text-sky-400 mt-0.5">Acct 2100 (Unapplied)</div>
        </div>

        {/* Open Invoices */}
        <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Open Invoices</div>
          <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {report?.customers.reduce((sum, c) => sum + c.invoices.length, 0) || 0} Invoices
          </div>
          <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">Trade receivables</div>
        </div>
      </div>

      {/* Desktop 4-Tier Aging KPI Grid (>= sm) */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Outstanding */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Receivables</div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {formatUSD(report?.summary.total_receivable ?? 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Gross trade debt across buyers</div>
        </div>

        {/* 0-30 Days */}
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            Current (0-30 Days)
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatUSD(report?.summary.current_0_30 ?? 0)}
          </div>
          <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400 mt-1">Within normal credit term</div>
        </div>

        {/* 31-60 Days */}
        <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/30 dark:bg-sky-950/20 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
            Aging (31-60 Days)
          </div>
          <div className="text-xl font-black text-sky-600 dark:text-sky-400 mt-1">
            {formatUSD(report?.summary.aging_31_60 ?? 0)}
          </div>
          <div className="text-[10px] text-sky-700/80 dark:text-sky-400 mt-1">Mild aging, follow-up active</div>
        </div>

        {/* 61-90 Days */}
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Aging (61-90 Days)
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {formatUSD(report?.summary.aging_61_90 ?? 0)}
          </div>
          <div className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-1">Collection reminder due</div>
        </div>

        {/* 90+ Days */}
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
            Overdue (90+ Days)
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {formatUSD(report?.summary.overdue_90_plus ?? 0)}
          </div>
          <div className="text-[10px] text-rose-700/80 dark:text-rose-400 mt-1">Requires supervisor escalation</div>
        </div>
      </div>

      {/* Customer List and Invoice Drill-Down */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Customer Accounts & Open Invoices
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click customer to view outstanding invoices and allocate incoming payments
            </p>
          </div>

          <div className="w-full sm:w-64 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No customers found with outstanding receivables.
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const isExpanded = expandedCustomerId === cust.customer_id;
              const hasOverdue = cust.overdue_90_plus > 0;

              return (
                <div key={cust.customer_id} className="transition-colors">
                  {/* Row Header (Clickable for Expand) */}
                  <div
                    onClick={() => setExpandedCustomerId(isExpanded ? null : cust.customer_id)}
                    className="p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer active:bg-slate-100/50"
                  >
                    <div className="flex items-center space-x-3 min-w-0 w-full md:w-auto">
                      <div className="shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {cust.customer_name}
                          </span>
                          {hasOverdue && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 shrink-0">
                              OVERDUE
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-2 mt-0.5">
                          <span>{cust.invoices.length} open invoice{cust.invoices.length === 1 ? "" : "s"}</span>
                          {cust.overdue_90_plus > 0 && (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              • 90+d: {formatUSD(cust.overdue_90_plus)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Financial Figures & Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto text-xs pt-1 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="text-left md:text-right">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Balance</span>
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {formatUSD(cust.total_outstanding)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <PdfDownloadButton
                            url={`/api/v1/customers/${cust.customer_id}/statement.pdf`}
                            filename={`AQ-Customer-Statement-${cust.customer_name}.pdf`}
                            label="Statement"
                            size="sm"
                          />
                        </div>

                        <Link
                          href={`/receivables/payments?customer_id=${cust.customer_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors whitespace-nowrap min-h-[36px] flex items-center justify-center"
                        >
                          Allocate Receipt
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Invoices Section */}
                  {isExpanded && (
                    <div className="p-3 sm:p-4 bg-slate-50/70 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800">
                      {/* Mobile Invoices Card List (< md) */}
                      <div className="md:hidden space-y-2">
                        {cust.invoices.map((inv) => (
                          <div
                            key={inv.invoice_id}
                            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {inv.invoice_number}
                              </span>
                              <div className="flex items-center space-x-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    inv.days_outstanding > 90
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                      : inv.days_outstanding > 60
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  }`}
                                >
                                  {inv.days_outstanding}d old
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    inv.status === "PAID"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : inv.status === "PARTIALLY PAID"
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1 pt-0.5 text-center">
                              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-[10px] text-slate-400 block">Invoiced</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {formatUSD(inv.amount)}
                                </span>
                              </div>
                              <div className="p-1.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30">
                                <span className="text-[10px] text-emerald-600 block">Received</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatUSD(inv.received)}
                                </span>
                              </div>
                              <div className="p-1.5 rounded-lg bg-slate-100/70 dark:bg-slate-800">
                                <span className="text-[10px] text-slate-500 block font-bold">Balance Due</span>
                                <span className="font-black text-slate-900 dark:text-white">
                                  {formatUSD(inv.balance)}
                                </span>
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-400 text-right">
                              Invoice Date: <span className="font-mono text-slate-600 dark:text-slate-300">{inv.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Invoices Table (>= md) */}
                      <table className="hidden md:table w-full text-left text-xs">
                        <thead>
                          <tr className="text-[10px] text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                            <th className="pb-2">Invoice #</th>
                            <th className="pb-2">Date</th>
                            <th className="pb-2 text-right">Invoiced Amount</th>
                            <th className="pb-2 text-right">Received</th>
                            <th className="pb-2 text-right">Balance Due</th>
                            <th className="pb-2 text-center">Days Outstanding</th>
                            <th className="pb-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {cust.invoices.map((inv) => (
                            <tr key={inv.invoice_id} className="hover:bg-white/60 dark:hover:bg-slate-900/60">
                              <td className="py-2.5 font-bold font-mono text-slate-900 dark:text-white">
                                {inv.invoice_number}
                              </td>
                              <td className="py-2.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                                {inv.date}
                              </td>
                              <td className="py-2.5 text-right font-medium text-slate-600 dark:text-slate-300">
                                {formatUSD(inv.amount)}
                              </td>
                              <td className="py-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                {formatUSD(inv.received)}
                              </td>
                              <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">
                                {formatUSD(inv.balance)}
                              </td>
                              <td className="py-2.5 text-center font-semibold">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    inv.days_outstanding > 90
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                      : inv.days_outstanding > 60
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  }`}
                                >
                                  {inv.days_outstanding} days
                                </span>
                              </td>
                              <td className="py-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    inv.status === "PAID"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : inv.status === "PARTIALLY PAID"
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
