"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  RefreshCw,
  Printer,
  ArrowLeft,
  Calendar,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

interface HorizonCard {
  horizon: string;
  date_range: string;
  expected_inflows: number;
  expected_outflows: number;
  net_projected_change: number;
  projected_closing_cash: number;
}

interface CollectionItem {
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  outstanding: number;
  expected_date: string;
  probability_pct: number;
  weighted_amount: number;
  status: string;
}

export default function CashForecastPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);
  const [editProb, setEditProb] = useState<number>(85);
  const [editDate, setEditDate] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<any>("/accounting/cash-forecast");
      setData(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      setSubmitting(true);
      await fetchApi("/accounting/cash-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: editingItem.invoice_id,
          expected_date: editDate || editingItem.expected_date,
          probability_pct: editProb,
        }),
      });
      setEditingItem(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update forecast item.");
    } finally {
      setSubmitting(false);
    }
  };

  const horizons: HorizonCard[] = data?.forecast_horizons || [];
  const planner: CollectionItem[] = data?.collection_planner || [];

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
            <span className="font-semibold text-slate-700 dark:text-slate-300">Cash Forecast</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Rolling Cash Forecast & Collection Planner</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            7, 30, 60, and 90-day cash projections &bull; Probability-weighted customer collection expectations.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Recalculate Projections</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Forecast</span>
          </button>
        </div>
      </div>

      {/* Strict Rule Notice Banner */}
      <div className="my-6 p-4 rounded-xl border border-sky-300 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 flex items-start space-x-3 shadow-xs">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold text-sm block mb-0.5">SECTION 25 COMPLIANCE: NON-GL FORECAST SEPARATION</span>
          <p>
            Cash forecasts and collection expectations are planning models only. They <strong>NEVER modify the General Ledger or post unearned journals</strong>. Current liquid base: <strong>{formatUSD(data?.current_liquid_funds || 0)}</strong>.
          </p>
        </div>
      </div>

      {/* 4 Horizon Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        {horizons.map((h) => {
          const isPositive = h.net_projected_change >= 0;
          return (
            <div key={h.horizon} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">{h.horizon} Horizon</span>
                <span className="text-[10px] font-mono text-slate-400">{h.date_range.split(" to ")[1]}</span>
              </div>

              <div className="mt-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="font-sans text-slate-500">Exp. Inflow:</span>
                  <span className="text-emerald-600 font-semibold">{formatUSD(h.expected_inflows)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-slate-500">Exp. Outflow:</span>
                  <span className="text-rose-600 font-semibold">{formatUSD(h.expected_outflows)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-sans text-slate-700 dark:text-slate-300">Net Flow:</span>
                  <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                    {formatUSD(h.net_projected_change)}
                  </span>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
                <span className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider block">
                  Projected Liquid Cash
                </span>
                <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                  {formatUSD(h.projected_closing_cash)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collection Planner Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden my-6">
        <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Customer Receivables Collection Planner
          </h2>
          <span className="text-xs text-slate-500">
            Weighted Collection Amount = Outstanding &times; Probability %
          </span>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Customer Name</th>
              <th className="py-3 px-4 text-right">Balance Due ($)</th>
              <th className="py-3 px-4 text-center">Expected Date</th>
              <th className="py-3 px-4 text-center">Probability %</th>
              <th className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">Weighted Flow ($)</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {planner.map((p) => (
              <tr key={p.invoice_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 font-bold text-sky-600">{p.invoice_number}</td>
                <td className="py-3 px-4 font-sans font-medium text-slate-900 dark:text-slate-100">{p.customer_name}</td>
                <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">{formatUSD(p.outstanding)}</td>
                <td className="py-3 px-4 text-center font-sans text-slate-500">{p.expected_date}</td>
                <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">{p.probability_pct}%</td>
                <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatUSD(p.weighted_amount)}</td>
                <td className="py-3 px-4 text-center font-sans">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    p.status === "EXPECTED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-sans">
                  <button
                    onClick={() => {
                      setEditingItem(p);
                      setEditProb(p.probability_pct);
                      setEditDate(p.expected_date);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 hover:bg-sky-100"
                  >
                    Adjust %
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Adjust Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Adjust Forecast: {editingItem.invoice_number}
            </h3>
            <p className="text-xs text-slate-500">{editingItem.customer_name} &bull; Outstanding: {formatUSD(editingItem.outstanding)}</p>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Expected Collection Date:</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Probability Percentage (1 - 100%):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editProb}
                  onChange={(e) => setEditProb(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-1.5 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
