"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Trash2,
  Check,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface JournalLineItem {
  account_code: string;
  party_name?: string;
  debit: number;
  credit: number;
  description?: string;
}

interface JournalEntry {
  id: number;
  entry_number: string;
  entry_date: string;
  entry_type: string;
  description: string;
  reference: string | null;
  total_debit: number;
  total_credit: number;
  status: string;
  lines_count: number;
  created_by: string;
  created_at: string | null;
}

interface Account {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
}

export default function JournalEntriesPage() {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // New Journal Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<JournalLineItem[]>([
    { account_code: "1000", debit: 0, credit: 0, description: "" },
    { account_code: "1100", debit: 0, credit: 0, description: "" },
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Detail Modal
  const [selectedJournal, setSelectedJournal] = useState<any>(null);

  // Reversal Modal
  const [reversalJournalId, setReversalJournalId] = useState<number | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [jRes, accRes] = await Promise.all([
        fetchApi<{ total: number; entries: JournalEntry[] }>("/accounting/journals"),
        fetchApi<Account[]>("/accounting/accounts"),
      ]);
      setJournals(jRes?.entries || []);
      setAccounts(accRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.005 && totalDebit > 0;

  const handleAddLine = () => {
    setLines([...lines, { account_code: "6400", debit: 0, credit: 0, description: "" }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof JournalLineItem, val: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: val };
    setLines(updated);
  };

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      setErrorMsg("Journal entry must be balanced (Total Debit == Total Credit) before saving.");
      return;
    }
    setErrorMsg(null);

    try {
      await fetchApi("/accounting/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_date: entryDate,
          description,
          reference,
          lines,
          created_by: "Admin",
        }),
      });
      setIsModalOpen(false);
      setDescription("");
      setReference("");
      setLines([
        { account_code: "1000", debit: 0, credit: 0, description: "" },
        { account_code: "1100", debit: 0, credit: 0, description: "" },
      ]);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to post journal entry.");
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const detail = await fetchApi(`/accounting/journals/${id}`);
      setSelectedJournal(detail);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmReversal = async () => {
    if (!reversalJournalId || !reversalReason.trim()) return;
    try {
      await fetchApi(`/accounting/journals/${reversalJournalId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reversalReason,
          user_name: "Admin",
        }),
      });
      setReversalJournalId(null);
      setReversalReason("");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to reverse journal entry.");
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-sky-600" />
            Journal Entries & General Journal
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Double-Entry Verification • Automatic & Manual Adjustments
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Manual Journal</span>
        </button>
      </div>

      <AccountingNav />

      {/* Journals Table */}
      <div className="table-container shadow-2xs">
        <table className="table">
          <thead>
            <tr>
              <th className="w-28">Journal #</th>
              <th className="w-24">Date</th>
              <th>Type</th>
              <th>Description / Memo</th>
              <th>Reference</th>
              <th className="text-right w-28">Total Debit</th>
              <th className="text-right w-28">Total Credit</th>
              <th className="text-center w-20">Status</th>
              <th className="text-center w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                  Loading journal entries...
                </td>
              </tr>
            ) : journals.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                  No journal entries recorded.
                </td>
              </tr>
            ) : (
              journals.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="font-mono font-bold text-sky-600 dark:text-sky-400 text-[11px]">
                    {j.entry_number}
                  </td>
                  <td className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                    {j.entry_date}
                  </td>
                  <td>
                    <span className="badge badge-neutral text-[9px] font-mono">
                      {j.entry_type}
                    </span>
                  </td>
                  <td>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-sm">
                      {j.description}
                    </div>
                  </td>
                  <td className="font-mono text-slate-500 text-xs">
                    {j.reference || "—"}
                  </td>
                  <td className="text-right font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                    {formatUSD(j.total_debit)}
                  </td>
                  <td className="text-right font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                    {formatUSD(j.total_credit)}
                  </td>
                  <td className="text-center">
                    <span
                      className={`badge text-[10px] ${
                        j.status === "POSTED"
                          ? "badge-success"
                          : j.status === "REVERSED"
                          ? "badge-warning"
                          : "badge-danger"
                      }`}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center space-x-1.5">
                      <button
                        onClick={() => handleViewDetail(j.id)}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-sky-600"
                        title="View Lines"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {j.status === "POSTED" && (
                        <button
                          onClick={() => setReversalJournalId(j.id)}
                          className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-950/40 text-slate-400 hover:text-amber-600"
                          title="Reverse Journal Entry"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Manual Journal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  New Double-Entry Journal
                </h3>
                <p className="text-[11px] text-slate-500">
                  Requires Total Debit = Total Credit. Unbalanced entries cannot be saved.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveJournal} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Reference</label>
                  <input
                    type="text"
                    placeholder="Check #, Wire #, Memo"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="Reason for journal adjustment..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Journal Lines Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="py-2 px-3 text-left w-56">Account</th>
                      <th className="py-2 px-3 text-left">Description</th>
                      <th className="py-2 px-3 text-right w-28">Debit ($)</th>
                      <th className="py-2 px-3 text-right w-28">Credit ($)</th>
                      <th className="py-2 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <select
                            value={l.account_code}
                            onChange={(e) => handleLineChange(idx, "account_code", e.target.value)}
                            className="select w-full text-xs py-1"
                          >
                            {accounts.map((a) => (
                              <option key={a.id} value={a.account_code}>
                                {a.account_code} - {a.account_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="Line memo..."
                            value={l.description || ""}
                            onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                            className="input w-full text-xs py-1"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.debit || ""}
                            onChange={(e) =>
                              handleLineChange(
                                idx,
                                "debit",
                                e.target.value === "" ? 0 : parseFloat(e.target.value)
                              )
                            }
                            className="input w-full text-right text-xs py-1 font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.credit || ""}
                            onChange={(e) =>
                              handleLineChange(
                                idx,
                                "credit",
                                e.target.value === "" ? 0 : parseFloat(e.target.value)
                              )
                            }
                            className="input w-full text-right text-xs py-1 font-mono"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30"
                            disabled={lines.length <= 2}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={handleAddLine}
                className="btn btn-secondary text-xs"
              >
                + Add Line
              </button>

              {/* Balance Summary Box */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border flex items-center justify-between font-mono text-xs">
                <div className="space-x-4">
                  <span>Total Debit: <b>${totalDebit.toFixed(2)}</b></span>
                  <span>Total Credit: <b>${totalCredit.toFixed(2)}</b></span>
                </div>
                <div>
                  {isBalanced ? (
                    <span className="text-emerald-600 font-bold flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> BALANCED ($0.00 Diff)
                    </span>
                  ) : (
                    <span className="text-rose-600 font-bold flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1" /> OUT OF BALANCE: ${difference.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced}
                  className="btn btn-primary font-bold disabled:opacity-50"
                >
                  Post Journal Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Journal Detail Modal */}
      {selectedJournal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="font-mono text-sky-600">{selectedJournal.entry_number}</span>
                  <span className="badge badge-neutral text-[9px]">{selectedJournal.entry_type}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedJournal.description}</p>
              </div>
              <button
                onClick={() => setSelectedJournal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Party</th>
                    <th>Description</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedJournal.lines?.map((l: any, i: number) => (
                    <tr key={i}>
                      <td className="font-bold">{l.account_code} - {l.account_name}</td>
                      <td>{l.party_name || "—"}</td>
                      <td className="text-slate-500">{l.description}</td>
                      <td className="text-right font-mono font-bold">{l.debit > 0 ? formatUSD(l.debit) : "—"}</td>
                      <td className="text-right font-mono font-bold">{l.credit > 0 ? formatUSD(l.credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedJournal(null)}
                className="btn btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reversal Confirmation Modal */}
      {reversalJournalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-500" />
              Reverse Journal Entry
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              This will create a new balancing journal entry with reversed debits and credits, marking the original as REVERSED.
            </p>
            <div>
              <label className="block font-semibold mb-1 text-xs">Reversal Reason *</label>
              <textarea
                rows={2}
                required
                placeholder="State the audit justification for reversing this entry..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="input w-full text-xs"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setReversalJournalId(null)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                disabled={!reversalReason.trim()}
                onClick={handleConfirmReversal}
                className="btn btn-primary font-bold text-xs disabled:opacity-50"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
