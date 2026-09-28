"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  Filter,
  Printer,
  Download,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

interface JournalLine {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  description: string;
}

interface JournalEntryItem {
  id: number;
  entry_number: string;
  entry_date: string;
  entry_type: string;
  reference: string;
  description: string;
  status: string;
  created_by: string;
  approved_by: string | null;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  lines_count: number;
  lines: JournalLine[];
}

export default function JournalReviewPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      let endpoint = "/accounting/journal-review";
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (typeFilter !== "ALL") params.append("entry_type", typeFilter);
      if (params.toString()) endpoint += `?${params.toString()}`;

      const res = await fetchApi<any>(endpoint);
      setData(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter]);

  const journals: JournalEntryItem[] = (data?.journals || []).filter((j: JournalEntryItem) =>
    j.entry_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (j.reference || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <span className="font-semibold text-slate-700 dark:text-slate-300">Journal Review</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">General Journal Audit & Entry Review</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Section 35: Draft, Posted, Reversed, and Manual journal entries with line-by-line debit/credit audit trail.
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
            <span>Print Review</span>
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 my-6">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search entry #, reference, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="POSTED">POSTED</option>
            <option value="REVERSED">REVERSED</option>
            <option value="DRAFT">DRAFT</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <option value="ALL">All Entry Types</option>
            <option value="MANUAL">MANUAL</option>
            <option value="SYSTEM">SYSTEM</option>
            <option value="REVERSAL">REVERSAL</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden my-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Entry #</th>
              <th className="py-3 px-4">Posting Date</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Reference</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Created By</th>
              <th className="py-3 px-4 text-right">Debit ($)</th>
              <th className="py-3 px-4 text-right">Credit ($)</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {journals.map((j) => {
              const isExpanded = expandedId === j.id;
              return (
                <React.Fragment key={j.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : j.id)}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-sky-600 flex items-center space-x-1.5">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{j.entry_number}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-sans">{j.entry_date}</td>
                    <td className="py-3 px-4 font-sans font-semibold">
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {j.entry_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{j.reference || "-"}</td>
                    <td className="py-3 px-4 font-sans text-slate-800 dark:text-slate-200 max-w-xs truncate">{j.description}</td>
                    <td className="py-3 px-4 font-sans text-slate-500">{j.created_by}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">{formatUSD(j.total_debit)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">{formatUSD(j.total_credit)}</td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        j.status === "POSTED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : j.status === "REVERSED"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}>
                        {j.status}
                      </span>
                    </td>
                  </tr>

                  {/* Lines drilldown */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80 dark:bg-slate-950/40">
                      <td colSpan={9} className="p-4 pl-10">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-sky-600" />
                          <span>Journal Entry Lines ({j.lines_count} lines):</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800/60 font-semibold text-slate-500">
                              <tr>
                                <th className="py-2 px-3">Account Code</th>
                                <th className="py-2 px-3">Account Name</th>
                                <th className="py-2 px-3">Line Memo</th>
                                <th className="py-2 px-3 text-right">Debit ($)</th>
                                <th className="py-2 px-3 text-right">Credit ($)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                              {j.lines.map((l, idx) => (
                                <tr key={idx}>
                                  <td className="py-2 px-3 text-sky-600 font-bold">{l.account_code}</td>
                                  <td className="py-2 px-3 font-sans text-slate-800 dark:text-slate-200">{l.account_name}</td>
                                  <td className="py-2 px-3 font-sans text-slate-500">{l.description}</td>
                                  <td className="py-2 px-3 text-right">{l.debit > 0 ? formatUSD(l.debit) : "-"}</td>
                                  <td className="py-2 px-3 text-right">{l.credit > 0 ? formatUSD(l.credit) : "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
