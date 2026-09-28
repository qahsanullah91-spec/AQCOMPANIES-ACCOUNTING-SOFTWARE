"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Target,
  Plus,
  RefreshCw,
  Printer,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

interface BudgetItem {
  id: number;
  account_code: string;
  category_name: string;
  period_name: string;
  budget_amount: number;
  actual_amount: number;
  variance: number;
  variance_pct: number;
  is_favorable: boolean;
}

export default function BudgetsAndVariancePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form state
  const [accountCode, setAccountCode] = useState<string>("4000");
  const [categoryName, setCategoryName] = useState<string>("Sales Revenue Target");
  const [budgetAmount, setBudgetAmount] = useState<string>("5000000");
  const [periodName, setPeriodName] = useState<string>("All Periods");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<any>(`/accounting/budgets?fiscal_year=${fiscalYear}`);
      setData(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, [fiscalYear]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await fetchApi("/accounting/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_code: accountCode,
          category_name: categoryName,
          fiscal_year: fiscalYear,
          period_name: periodName,
          budget_amount: Number(budgetAmount),
          notes: notes,
        }),
      });
      setShowAddModal(false);
      loadBudgets();
    } catch (err: any) {
      alert(err.message || "Failed to save budget entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const totals = data?.totals || {};
  const items: BudgetItem[] = data?.items || [];

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
            <span className="font-semibold text-slate-700 dark:text-slate-300">Budgets & Variance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Budget Allocation & Variance Analysis</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Compare planned fiscal targets against actual general ledger performance.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Target / Budget</span>
          </button>
          <button
            onClick={loadBudgets}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Allocated Budget</span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatUSD(totals.budget || 0)}
          </div>
          <span className="text-xs text-slate-400">Fiscal Year {fiscalYear} Target Base</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Actual General Ledger</span>
          <div className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-1 font-mono">
            {formatUSD(totals.actual || 0)}
          </div>
          <span className="text-xs text-slate-400">Realized Revenue & Costs</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Variance</span>
          <div className={`text-xl font-bold mt-1 font-mono ${
            (totals.variance || 0) >= 0 ? "text-emerald-600" : "text-amber-600"
          }`}>
            {formatUSD(totals.variance || 0)}
          </div>
          <span className="text-xs text-slate-400">Budget vs Actual Difference</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden my-6">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Account Code</th>
              <th className="py-3 px-4">Category Name</th>
              <th className="py-3 px-4">Period</th>
              <th className="py-3 px-4 text-right">Budget ($)</th>
              <th className="py-3 px-4 text-right">Actual ($)</th>
              <th className="py-3 px-4 text-right">Variance ($)</th>
              <th className="py-3 px-4 text-right">Variance (%)</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {items.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 font-bold text-sky-600">{b.account_code}</td>
                <td className="py-3 px-4 font-sans font-medium text-slate-900 dark:text-slate-100">{b.category_name}</td>
                <td className="py-3 px-4 font-sans text-slate-500">{b.period_name}</td>
                <td className="py-3 px-4 text-right font-semibold text-slate-700 dark:text-slate-300">{formatUSD(b.budget_amount)}</td>
                <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">{formatUSD(b.actual_amount)}</td>
                <td className={`py-3 px-4 text-right font-bold ${b.is_favorable ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatUSD(b.variance)}
                </td>
                <td className={`py-3 px-4 text-right ${b.is_favorable ? "text-emerald-600" : "text-rose-600"}`}>
                  {b.variance_pct}%
                </td>
                <td className="py-3 px-4 text-center font-sans">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    b.is_favorable
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  }`}>
                    {b.is_favorable ? "FAVORABLE" : "UNFAVORABLE"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Budget Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Create Fiscal Budget Target
            </h3>

            <form onSubmit={handleSaveBudget} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Code (e.g. 4000 Sales, 6000 Rent, 6100 Salaries, 5100 Freight):
                </label>
                <input
                  type="text"
                  required
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category Name / Target Description:
                </label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Budget Amount ($ USD):
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Period / Horizon:
                </label>
                <select
                  value={periodName}
                  onChange={(e) => setPeriodName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <option value="All Periods">All Periods (Annual 2026)</option>
                  <option value="Q1 2026">Q1 2026</option>
                  <option value="Q2 2026">Q2 2026</option>
                  <option value="Q3 2026">Q3 2026</option>
                  <option value="Q4 2026">Q4 2026</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white"
                >
                  {submitting ? "Saving..." : "Save Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
