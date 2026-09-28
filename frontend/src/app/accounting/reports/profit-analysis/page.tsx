"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  Search,
  Printer,
  Download,
  ArrowLeft,
  RefreshCw,
  Users,
  Truck,
  TrendingUp,
  AlertTriangle,
  Scale,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD, formatWeight } from "@/lib/api";

export default function ProfitAnalysisReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"CUSTOMER" | "SHIPMENT">("SHIPMENT");
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [shipmentData, setShipmentData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, sRes] = await Promise.all([
        fetchApi<any>("/accounting/reports/customer-profit"),
        fetchApi<any>("/accounting/reports/shipment-profit"),
      ]);
      setCustomerData(cRes.customers || []);
      setShipmentData(sRes.shipments || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load profitability analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCustomers = customerData.filter((c) =>
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredShipments = shipmentData.filter((s) =>
    (s.invoice_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.container_number || "").toLowerCase().includes(searchTerm.toLowerCase())
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
            <span className="font-semibold text-slate-700 dark:text-slate-300">Profitability Analytics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Customer, Shipment & Unit Profitability</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Margin %, Profit per KG, and quarantine tracking for incomplete Afghan supplier purchase costs.
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
            <span>Print Analysis</span>
          </button>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex items-center justify-between my-6">
        <div className="flex items-center space-x-2 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setViewMode("SHIPMENT")}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
              viewMode === "SHIPMENT"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>By Shipment & Per KG ({shipmentData.length})</span>
          </button>
          <button
            onClick={() => setViewMode("CUSTOMER")}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
              viewMode === "CUSTOMER"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>By Customer Margin ({customerData.length})</span>
          </button>
        </div>

        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={viewMode === "SHIPMENT" ? "Search invoice or container..." : "Search customer..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* VIEW 1: SHIPMENT LEVEL & PER KG */}
      {viewMode === "SHIPMENT" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Container</th>
                <th className="py-3 px-4 text-right">Net Weight</th>
                <th className="py-3 px-4 text-right">Sales ($)</th>
                <th className="py-3 px-4 text-right">Purchase ($)</th>
                <th className="py-3 px-4 text-right">Transport ($)</th>
                <th className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">Known Profit</th>
                <th className="py-3 px-4 text-right">Profit / KG</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {filteredShipments.map((s: any) => (
                <tr key={s.invoice_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 text-sky-600 font-bold">{s.invoice_number}</td>
                  <td className="py-3 px-4 font-sans font-medium text-slate-800 dark:text-slate-200">{s.customer_name}</td>
                  <td className="py-3 px-4 font-sans text-slate-500">{s.container_number || "-"}</td>
                  <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{formatWeight(s.net_kg)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">{formatUSD(s.sales_amount)}</td>
                  <td className="py-3 px-4 text-right text-slate-500">
                    {s.is_cost_pending ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-sans font-medium">
                        Pending Bill
                      </span>
                    ) : (
                      formatUSD(s.purchase_cost)
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{formatUSD(s.transport_cost)}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatUSD(s.known_profit)}</td>
                  <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                    {s.is_cost_pending ? (
                      <span className="text-[10px] text-amber-600 font-sans">Pending</span>
                    ) : (
                      `$${s.profit_per_kg?.toFixed(4)}/KG`
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      s.is_cost_pending
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW 2: CUSTOMER LEVEL */}
      {viewMode === "CUSTOMER" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4 text-center">Invoices</th>
                <th className="py-3 px-4 text-right">Invoiced Sales ($)</th>
                <th className="py-3 px-4 text-right">Transport Freight ($)</th>
                <th className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">Known Profit</th>
                <th className="py-3 px-4 text-right">Est. Margin %</th>
                <th className="py-3 px-4 text-right">AR Outstanding</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {filteredCustomers.map((c: any) => (
                <tr key={c.customer_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-slate-100">{c.customer_name}</td>
                  <td className="py-3 px-4 text-center font-sans text-slate-500">{c.invoices_count}</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">{formatUSD(c.sales_amount)}</td>
                  <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{formatUSD(c.transport_cost)}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatUSD(c.known_profit)}</td>
                  <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                    {c.has_pending_cost ? (
                      <span className="text-[10px] text-amber-600 font-sans">Pending Costs</span>
                    ) : (
                      `${c.margin_pct}%`
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-sky-600">{formatUSD(c.outstanding_receivable)}</td>
                  <td className="py-3 px-4 text-center font-sans">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      c.has_pending_cost
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}>
                      {c.cost_status}
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
}
