"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Scale,
  ShieldCheck,
  ArrowLeft,
  Check,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface AccountOption {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
}

interface JournalLineForm {
  account_id: number | "";
  description: string;
  debit: string;
  credit: string;
}

export default function NewJournalEntryPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [entryType, setEntryType] = useState<string>("MANUAL");
  const [reference, setReference] = useState<string>("");
  const [mainDescription, setMainDescription] = useState<string>("");

  const [lines, setLines] = useState<JournalLineForm[]>([
    { account_id: "", description: "", debit: "", credit: "" },
    { account_id: "", description: "", debit: "", credit: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoadingAccounts(true);
        const data = await fetchApi<AccountOption[]>("/accounting/accounts");
        setAccounts(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("Failed to load chart of accounts", err);
      } finally {
        setLoadingAccounts(false);
      }
    }
    loadAccounts();
  }, []);

  function handleAddLine() {
    setLines([...lines, { account_id: "", description: mainDescription, debit: "", credit: "" }]);
  }

  function handleRemoveLine(index: number) {
    if (lines.length <= 2) {
      alert("A double-entry journal entry must have at least 2 lines.");
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  }

  function handleLineChange(index: number, field: keyof JournalLineForm, value: string | number) {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };

    // Mutually exclusive debit and credit inputs
    if (field === "debit" && value !== "") {
      updated[index].credit = "";
    } else if (field === "credit" && value !== "") {
      updated[index].debit = "";
    }

    setLines(updated);
  }

  // Calculations
  const totalDebit = lines.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.001 && totalDebit > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isBalanced) {
      setErrorMessage("Journal entry must be perfectly balanced (Total Debits == Total Credits).");
      return;
    }
    if (!mainDescription.trim()) {
      setErrorMessage("Please enter an overall journal description.");
      return;
    }

    // Verify all lines have accounts selected
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].account_id) {
        setErrorMessage(`Please select an account for line #${i + 1}.`);
        return;
      }
      const deb = parseFloat(lines[i].debit) || 0;
      const cred = parseFloat(lines[i].credit) || 0;
      if (deb === 0 && cred === 0) {
        setErrorMessage(`Line #${i + 1} must have a non-zero Debit or Credit amount.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = {
        entry_date: entryDate,
        entry_type: entryType,
        description: mainDescription,
        reference: reference || null,
        lines: lines.map((l) => ({
          account_id: Number(l.account_id),
          description: l.description || mainDescription,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
      };

      const res = await fetchApi<any>("/accounting/journals", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      router.push("/accounting/journals");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to post journal entry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-bold mb-1">
            <Link href="/accounting/journals" className="hover:text-sky-600 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Journals List
            </Link>
            <span>/</span>
            <span>New Manual Voucher</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-sky-600" />
            New Double-Entry Journal Entry
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Double-Entry General Ledger • Atomic Balance Check (Debit == Credit)
          </p>
        </div>

        <Link href="/accounting/journals" className="btn btn-secondary text-xs font-bold">
          Cancel
        </Link>
      </div>

      <AccountingNav />

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-center space-x-3 text-rose-800 dark:text-rose-200 text-sm font-semibold">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Details Card */}
        <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Voucher Header Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Posting Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                className="input w-full text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Journal Type
              </label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                className="input w-full text-xs font-semibold"
              >
                <option value="MANUAL">MANUAL (Standard Journal)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (Auditor Correction)</option>
                <option value="ACCRUAL">ACCRUAL (Month-End Accrual)</option>
                <option value="PERIOD_CLOSE">PERIOD_CLOSE (Year-End Close)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                External Reference (Optional)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. Wire Slip #, Auditor Ref..."
                className="input w-full text-xs font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              General Ledger Description / Memo
            </label>
            <input
              type="text"
              value={mainDescription}
              onChange={(e) => setMainDescription(e.target.value)}
              placeholder="e.g. Month-end adjustment of freight accruals"
              required
              className="input w-full text-xs"
            />
          </div>
        </div>

        {/* Multi-Line Journal Editor */}
        <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Double-Entry Ledger Lines (Min. 2 Lines)
            </h2>
            <button
              type="button"
              onClick={handleAddLine}
              className="btn btn-secondary text-xs font-bold py-1 px-3 flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 w-64">General Ledger Account</th>
                  <th className="py-2.5 px-3">Line Memo</th>
                  <th className="py-2.5 px-3 w-36 text-right">Debit ($)</th>
                  <th className="py-2.5 px-3 w-36 text-right">Credit ($)</th>
                  <th className="py-2.5 px-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-3 text-center font-mono text-slate-400 font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={line.account_id}
                        onChange={(e) => handleLineChange(idx, "account_id", Number(e.target.value))}
                        required
                        className="input w-full text-xs font-semibold py-1.5"
                      >
                        <option value="">Select Account...</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.account_code} - {acc.account_name} ({acc.account_type})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                        placeholder="Line memo (optional)"
                        className="input w-full text-xs py-1.5"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debit}
                        onChange={(e) => handleLineChange(idx, "debit", e.target.value)}
                        placeholder="0.00"
                        className="input w-full text-xs font-mono font-bold text-right py-1.5"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.credit}
                        onChange={(e) => handleLineChange(idx, "credit", e.target.value)}
                        placeholder="0.00"
                        className="input w-full text-xs font-mono font-bold text-right py-1.5"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        disabled={lines.length <= 2}
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-30 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 font-mono font-black text-xs">
                  <td colSpan={3} className="py-3 px-3 text-right uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Totals:
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-sky-600 dark:text-sky-400">
                    {formatUSD(totalDebit)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-sky-600 dark:text-sky-400">
                    {formatUSD(totalCredit)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Live Balance Tracker & Submit Card */}
        <div
          className={`card p-5 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isBalanced
              ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
              : "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60"
          }`}
        >
          <div className="flex items-center space-x-3">
            {isBalanced ? (
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
            )}
            <div>
              <div
                className={`text-sm font-black ${
                  isBalanced ? "text-emerald-900 dark:text-emerald-200" : "text-rose-900 dark:text-rose-200"
                }`}
              >
                {isBalanced ? "Journal Entry is Balanced ($0.00 Difference)" : "Out of Balance — Cannot Post"}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Debits: {formatUSD(totalDebit)} • Credits: {formatUSD(totalCredit)} • Variance:{" "}
                <span className="font-bold">${difference.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="submit"
              disabled={!isBalanced || submitting}
              className="btn btn-primary text-xs font-black py-2.5 px-6 flex items-center space-x-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Posting to General Ledger...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Post Journal Entry →</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
