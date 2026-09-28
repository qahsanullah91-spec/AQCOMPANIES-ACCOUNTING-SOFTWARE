"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Printer,
  ArrowLeft,
  Filter,
  Search,
  Eye,
  Lock,
  ArrowRightLeft,
  ShieldCheck,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

interface AuditAlert {
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  date: string;
  reference: string;
  party_name: string;
  amount: number;
  details: string;
  requires_review: boolean;
}

export default function AuditCenterPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    try {
      let endpoint = "/accounting/audit-center";
      if (riskFilter !== "ALL") endpoint += `?risk_level=${riskFilter}`;
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
  }, [riskFilter]);

  const alerts: AuditAlert[] = (data?.alerts || []).filter((a: AuditAlert) =>
    a.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.category.toLowerCase().includes(searchTerm.toLowerCase())
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
            <span className="font-semibold text-slate-700 dark:text-slate-300">Audit Center</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Audit & High-Risk Control Center</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Forensic monitoring: Large disbursements, manual control account alterations, reversals & reopened periods.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Rescan Ledger</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Audit Log</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Audit Alerts</span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {data?.total_alerts || 0}
          </div>
          <span className="text-xs text-slate-400">Total Flagged Accounting Events</span>
        </div>

        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 shadow-2xs">
          <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">High-Risk Items</span>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {data?.high_risk_count || 0}
          </div>
          <span className="text-xs text-rose-600/80">Disbursements &gt; $100K or Control Postings</span>
        </div>

        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 shadow-2xs">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Medium-Risk Items</span>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {data?.medium_risk_count || 0}
          </div>
          <span className="text-xs text-amber-600/80">Journal Reversals or Payments &gt; $25K</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search reference, details, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          {["ALL", "HIGH", "MEDIUM"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setRiskFilter(lvl)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                riskFilter === lvl
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {lvl} RISK
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden my-4">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Risk Level</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Reference</th>
              <th className="py-3 px-4">Actor / Party</th>
              <th className="py-3 px-4 text-right">Amount ($)</th>
              <th className="py-3 px-4">Details & Audit Findings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {alerts.map((a, idx) => (
              <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 font-sans">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    a.risk_level === "HIGH"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}>
                    {a.risk_level}
                  </span>
                </td>
                <td className="py-3 px-4 font-sans font-semibold text-slate-800 dark:text-slate-200">{a.category}</td>
                <td className="py-3 px-4 text-slate-500 font-sans">{a.date}</td>
                <td className="py-3 px-4 font-bold text-sky-600">{a.reference}</td>
                <td className="py-3 px-4 font-sans text-slate-700 dark:text-slate-300">{a.party_name}</td>
                <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                  {a.amount > 0 ? formatUSD(a.amount) : "-"}
                </td>
                <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-400 max-w-md">
                  {a.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
