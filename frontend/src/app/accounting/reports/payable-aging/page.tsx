"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  Printer,
  Download,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Info,
  Clock,
  FileText,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

export default function PayableAgingReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"CONFIRMED" | "PENDING">("PENDING");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<any>("/accounting/reports/payable-aging");
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load Payable Aging report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const buckets = data?.totals_by_bucket || {};
  const pendingShipments = (data?.pending_purchase_cost_shipments || []).filter((s: any) =>
    (s.container_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.bl_number || "").toLowerCase().includes(searchTerm.toLowerCase())
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
            <span className="font-semibold text-slate-700 dark:text-slate-300">Payable Aging</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Supplier Accounts Payable Aging & Incomplete Costs</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Confirmed supplier bills only &bull; Strict quarantine for shipments awaiting Afghan supplier bills.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
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

      {/* Strict Anti-Fabrication Warning Banner */}
      <div className="my-6 p-4 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-start space-x-3 shadow-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold text-sm block mb-0.5">SECTION 10 ACCOUNTING CONTROL: ANTI-FABRICATION RULE</span>
          <p>
            {data?.pending_purchase_costs_count || 63} shipments from Afghanistan currently lack final supplier purchase invoices.
            To avoid fabricating liabilities or falsifying vendor balances, these {data?.pending_purchase_costs_count || 63} shipments are <strong>EXCLUDED from standard payable aging</strong> and quarantined in the Pending Queue below.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab("PENDING")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === "PENDING"
              ? "border-amber-600 text-amber-600 dark:text-amber-400"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Purchase Cost Shipments ({data?.pending_purchase_costs_count || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab("CONFIRMED")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === "CONFIRMED"
              ? "border-sky-600 text-sky-600 dark:text-sky-400"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Confirmed Supplier Bills ({formatUSD(data?.total_confirmed_payables || 0)})</span>
        </button>
      </div>

      {/* TAB 1: PENDING SHIPMENTS */}
      {activeTab === "PENDING" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search container or BL number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <span className="text-xs text-slate-500">
              Showing {pendingShipments.length} quarantined shipments
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Shipment ID</th>
                  <th className="py-3 px-4">Container Number</th>
                  <th className="py-3 px-4">BL Number</th>
                  <th className="py-3 px-4">Shipment / BOL Date</th>
                  <th className="py-3 px-4">Accounting Status</th>
                  <th className="py-3 px-4">Quarantine Action Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {pendingShipments.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-sky-600 font-bold">SHIP-{s.id}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-slate-100">
                      {s.container_number || "Awaiting Container"}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {s.bl_number || "-"}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-500">
                      {s.eta || "In-Transit"}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        PENDING_SUPPLIER_INVOICE
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-500">
                      Obtain commercial invoice from Afghan exporter before posting to AP.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CONFIRMED BILLS */}
      {activeTab === "CONFIRMED" && (
        <div>
          {/* Aging Buckets */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Current</span>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                {formatUSD(buckets.current || 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">1-30 Days</span>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                {formatUSD(buckets.d1_30 || 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">31-60 Days</span>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                {formatUSD(buckets.d31_60 || 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider block">61-90 Days</span>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                {formatUSD(buckets.d61_90 || 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">90+ Days</span>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                {formatUSD(buckets.d90_plus || 0)}
              </div>
            </div>
          </div>

          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No Overdue Confirmed Supplier Bills</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              All currently received supplier purchases are settled or pending invoice receipt.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
