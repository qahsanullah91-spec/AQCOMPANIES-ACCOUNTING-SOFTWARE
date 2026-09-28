"use client";

import React, { useState, useEffect } from "react";
import {
  Scale,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

interface OpeningEntry {
  id: number;
  entry_code: string;
  entity_type: string;
  entity_name: string;
  opening_debit: number;
  opening_credit: number;
  currency: string;
  effective_date: string;
  reference?: string;
  notes?: string;
  journal_entry_id?: number;
  created_by?: string;
  created_at?: string;
}

export default function OpeningBalancesPage() {
  const [entries, setEntries] = useState<OpeningEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    entity_type: "BANK_ACCOUNT",
    entity_name: "",
    debit: "",
    credit: "",
    currency: "USD",
    effective_date: new Date().toISOString().split("T")[0],
    reference: "",
    notes: "",
  });

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<OpeningEntry[]>("/accounting/opening-balances");
      setEntries(res || []);
    } catch (err: any) {
      setActionError(err.message || "Failed to load opening balances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await fetchApi<any>("/accounting/opening-balances", {
        method: "POST",
        body: JSON.stringify({
          entity_type: form.entity_type,
          entity_name: form.entity_name,
          debit: form.debit ? Number(form.debit) : 0,
          credit: form.credit ? Number(form.credit) : 0,
          currency: form.currency,
          effective_date: form.effective_date,
          reference: form.reference,
          notes: form.notes,
        }),
      });
      setActionSuccess(`Opening balance ${res.entry_code} established with balanced GL entry!`);
      setShowModal(false);
      setForm({
        entity_type: "BANK_ACCOUNT",
        entity_name: "",
        debit: "",
        credit: "",
        currency: "USD",
        effective_date: new Date().toISOString().split("T")[0],
        reference: "",
        notes: "",
      });
      loadEntries();
    } catch (err: any) {
      setActionError(err.message || "Failed to establish opening balance");
    }
  };

  const totalDebits = entries.reduce((s, e) => s + (e.opening_debit || 0), 0);
  const totalCredits = entries.reduce((s, e) => s + (e.opening_credit || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-bold font-mono rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              EQUITY OFFSET • ACCOUNT 3000
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Opening Balance Equity Rule
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Formal Opening Balance Initialization
          </h1>
          <p className="text-xs text-slate-500">
            Establish verified opening balances with automatic double-entry offsetting against Account 3000 Opening Balance Equity.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Opening Balance</span>
        </button>
      </div>

      <AccountingNav />

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-300">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Opening Debits</span>
          <div className="text-xl font-black font-mono text-emerald-600 mt-1">
            {formatUSD(totalDebits)}
          </div>
          <p className="text-2xs text-slate-400 mt-1">Asset debits (Banks, Cash, Receivables)</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Opening Credits</span>
          <div className="text-xl font-black font-mono text-indigo-600 mt-1">
            {formatUSD(totalCredits)}
          </div>
          <p className="text-2xs text-slate-400 mt-1">Liabilities & Payable credits</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Account 3000 Equity Net</span>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
            {formatUSD(totalDebits - totalCredits)}
          </div>
          <p className="text-2xs text-slate-400 mt-1">Self-balancing double-entry guarantee</p>
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Opening Balance Register & Audit Log
          </h2>
          <button
            onClick={loadEntries}
            className="p-1.5 text-slate-500 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-2xs font-semibold">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Effective Date</th>
                <th className="px-4 py-3">Entity Type</th>
                <th className="px-4 py-3">Entity Name</th>
                <th className="px-4 py-3 text-right">Debit Balance</th>
                <th className="px-4 py-3 text-right">Credit Balance</th>
                <th className="px-4 py-3">Offset Account</th>
                <th className="px-4 py-3">Journal Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No custom opening balance entries recorded.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-sky-600">{e.entry_code}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{e.effective_date}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {e.entity_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                      {e.entity_name}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-emerald-600">
                      {e.opening_debit > 0 ? formatUSD(e.opening_debit) : "-"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-rose-600">
                      {e.opening_credit > 0 ? formatUSD(e.opening_credit) : "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-2xs text-slate-500">
                      3000 Owner Equity
                    </td>
                    <td className="px-4 py-3 font-mono text-2xs text-sky-600">
                      {e.reference || `JE #${e.journal_entry_id || "-"}`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Opening Balance */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Initialize Opening Balance
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Balances against Account 3000 Opening Balance Equity. Never creates unbacked numbers.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Entity Category
                </label>
                <select
                  value={form.entity_type}
                  onChange={(e) => setForm({ ...form, entity_type: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-semibold"
                >
                  <option value="BANK_ACCOUNT">Bank Account (GL 1000)</option>
                  <option value="CASH_ACCOUNT">Cash Vault (GL 1010)</option>
                  <option value="SARAFI_ACCOUNT">Sarafi Hawala Desk (GL 1030)</option>
                  <option value="CUSTOMER">Customer Receivable (GL 1100)</option>
                  <option value="SUPPLIER">Supplier Payable (GL 2000)</option>
                  <option value="TRANSPORT">Carrier / Sky Ariana (GL 2100)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Entity / Account Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Afghan United Bank USD Vault or Sky Ariana"
                  value={form.entity_name}
                  onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Opening Debit ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.debit}
                    onChange={(e) => setForm({ ...form, debit: e.target.value, credit: "" })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Opening Credit ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.credit}
                    onChange={(e) => setForm({ ...form, credit: e.target.value, debit: "" })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="AFN">AFN</option>
                    <option value="AED">AED</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reference / Documentation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Opening Balance Audited Statement 2026"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl"
                >
                  Post Opening Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
