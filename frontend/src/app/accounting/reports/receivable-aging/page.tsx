"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Printer,
  Download,
  ArrowLeft,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

export default function ReceivableAgingReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [expandedCust, setExpandedCust] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<any>("/accounting/reports/receivable-aging");
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load Receivable Aging report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const buckets = data?.totals_by_bucket || {};
  const customers = (data?.customers || []).filter((c: any) =>
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <span className="font-semibold text-slate-700 dark:text-slate-300">Receivable Aging</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Accounts Receivable Aging Analysis</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            6-bucket overdue categorization: Current, 1-30, 31-60, 61-90, 91-120, and 120+ days.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Aging</span>
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

      {/* 6 Bucket Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 my-6">
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Current</span>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatUSD(buckets.current || 0)}
          </div>
          <span className="text-[10px] text-slate-400">Not yet due</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">1 - 30 Days</span>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatUSD(buckets.d1_30 || 0)}
          </div>
          <span className="text-[10px] text-emerald-500 font-medium">Low risk</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">31 - 60 Days</span>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatUSD(buckets.d31_60 || 0)}
          </div>
          <span className="text-[10px] text-amber-500 font-medium">Attention</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider block">61 - 90 Days</span>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatUSD(buckets.d61_90 || 0)}
          </div>
          <span className="text-[10px] text-orange-500 font-medium">Overdue</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">91 - 120 Days</span>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatUSD(buckets.d91_120 || 0)}
          </div>
          <span className="text-[10px] text-rose-500 font-medium">High risk</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">120+ Days</span>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatUSD(buckets.d120_plus || 0)}
          </div>
          <span className="text-[10px] text-purple-500 font-medium">Critical</span>
        </div>

        <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 shadow-2xs">
          <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider block">Total AR</span>
          <div className="text-base font-black text-sky-700 dark:text-sky-400 mt-1 font-mono">
            {formatUSD(data?.total_outstanding || 0)}
          </div>
          <span className="text-[10px] text-sky-600 font-medium">Authoritative</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Customers Aging Table with Drilldown */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden my-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4 text-right">Current</th>
              <th className="py-3 px-4 text-right">1-30 Days</th>
              <th className="py-3 px-4 text-right">31-60 Days</th>
              <th className="py-3 px-4 text-right">61-90 Days</th>
              <th className="py-3 px-4 text-right">91-120 Days</th>
              <th className="py-3 px-4 text-right">120+ Days</th>
              <th className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">Total Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
            {customers.map((c: any) => {
              const isExpanded = expandedCust === c.customer_id;
              return (
                <React.Fragment key={c.customer_id}>
                  <tr
                    onClick={() => setExpandedCust(isExpanded ? null : c.customer_id)}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-sky-600 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>{c.customer_name}</span>
                      <span className="text-[10px] font-mono font-normal text-slate-400">({c.invoices?.length || 0} invoices)</span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">{c.current > 0 ? formatUSD(c.current) : "-"}</td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-semibold">{c.d1_30 > 0 ? formatUSD(c.d1_30) : "-"}</td>
                    <td className="py-3 px-4 text-right text-amber-600 font-semibold">{c.d31_60 > 0 ? formatUSD(c.d31_60) : "-"}</td>
                    <td className="py-3 px-4 text-right text-orange-600 font-semibold">{c.d61_90 > 0 ? formatUSD(c.d61_90) : "-"}</td>
                    <td className="py-3 px-4 text-right text-rose-600 font-semibold">{c.d91_120 > 0 ? formatUSD(c.d91_120) : "-"}</td>
                    <td className="py-3 px-4 text-right text-purple-600 font-semibold">{c.d120_plus > 0 ? formatUSD(c.d120_plus) : "-"}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">{formatUSD(c.total_outstanding)}</td>
                  </tr>

                  {/* Drilldown rows for customer invoices */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80 dark:bg-slate-950/40">
                      <td colSpan={8} className="p-4 pl-10">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-sky-600" />
                          <span>Unpaid Invoices for {c.customer_name}:</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {c.invoices?.map((inv: any) => (
                            <div key={inv.id} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                                <span>{inv.invoice_number}</span>
                                <span className="text-sky-600">{formatUSD(inv.balance_due)}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 font-sans">
                                <span>Dated: {inv.date}</span>
                                <span className="px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium">
                                  {inv.days_outstanding} days old
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-black">
              <td className="py-3 px-4 font-sans">TOTAL AR AGING</td>
              <td className="py-3 px-4 text-right font-mono">{formatUSD(buckets.current || 0)}</td>
              <td className="py-3 px-4 text-right font-mono text-emerald-600">{formatUSD(buckets.d1_30 || 0)}</td>
              <td className="py-3 px-4 text-right font-mono text-amber-600">{formatUSD(buckets.d31_60 || 0)}</td>
              <td className="py-3 px-4 text-right font-mono text-orange-600">{formatUSD(buckets.d61_90 || 0)}</td>
              <td className="py-3 px-4 text-right font-mono text-rose-600">{formatUSD(buckets.d91_120 || 0)}</td>
              <td className="py-3 px-4 text-right font-mono text-purple-600">{formatUSD(buckets.d120_plus || 0)}</td>
              <td className="py-3 px-4 text-right font-mono text-sky-600 text-sm">{formatUSD(data?.total_outstanding || 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
