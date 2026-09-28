"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RefreshCw,
  Link as LinkIcon,
  Unlink,
  FileSpreadsheet,
  Check,
  X,
  Layers,
  ArrowRight,
  Landmark,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { BankingNav } from "@/components/BankingNav";

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  currency: string;
}

interface ReconciliationData {
  bank_account: {
    id: number;
    bank_name: string;
    account_number: string;
    currency: string;
  };
  balances: {
    statement_closing_balance: number;
    system_closing_balance: number;
    difference: number;
    is_reconciled: boolean;
  };
  ledger_transactions: Array<{
    id: number;
    code: string;
    date: string;
    party_name: string;
    type: string;
    money_in: number;
    money_out: number;
    reference: string | null;
    status: string;
    is_reversed: boolean;
  }>;
  statement_lines: Array<{
    id: number;
    batch_id: string;
    date: string;
    description: string;
    reference: string | null;
    debit: number;
    credit: number;
    matched_status: string;
    matched_bank_transaction_id: number | null;
  }>;
}

export function BankReconciliationView({ initialAccountId }: { initialAccountId?: number }) {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number>(initialAccountId || 1);
  const [statementBalance, setStatementBalance] = useState<string>("");
  const [reconData, setReconData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import Modal
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [rawCsvText, setRawCsvText] = useState("");
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Selected statement line and ledger tx for manual matching
  const [selectedStmtLineId, setSelectedStmtLineId] = useState<number | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);

  const loadAccounts = async () => {
    try {
      const accs = await fetchApi<BankAccount[]>("/accounting/banks");
      setBankAccounts(accs || []);
      if (accs && accs.length > 0 && !initialAccountId) {
        setSelectedBankId(accs[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadReconciliation = async () => {
    if (!selectedBankId) return;
    try {
      setLoading(true);
      setError(null);
      let url = `/accounting/reconciliation/${selectedBankId}`;
      if (statementBalance.trim()) {
        url += `?statement_closing_balance=${parseFloat(statementBalance)}`;
      }
      const data = await fetchApi<ReconciliationData>(url);
      setReconData(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load reconciliation workbench.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedBankId) {
      loadReconciliation();
    }
  }, [selectedBankId]);

  const handleMatchAction = async (action: "MATCH" | "UNMATCH", stmtLineId: number, txId?: number) => {
    try {
      setError(null);
      await fetchApi("/accounting/reconciliation/match-action", {
        method: "POST",
        body: JSON.stringify({
          action,
          statement_line_id: stmtLineId,
          transaction_id: txId,
        }),
      });
      setSelectedStmtLineId(null);
      setSelectedTxId(null);
      await loadReconciliation();
    } catch (err: any) {
      setError(err.message || "Failed to apply reconciliation match.");
    }
  };

  const handlePreviewImport = async () => {
    if (!rawCsvText.trim()) return;
    try {
      setPreviewing(true);
      setError(null);

      // Parse CSV or JSON rows
      let parsedRows: any[] = [];
      try {
        parsedRows = JSON.parse(rawCsvText);
      } catch {
        // Simple CSV parse
        const lines = rawCsvText.trim().split("\n");
        parsedRows = lines.map((l) => {
          const parts = l.split(",").map((p) => p.trim());
          return {
            date: parts[0] || "",
            description: parts[1] || "",
            reference: parts[2] || "",
            debit: parseFloat(parts[3]) || 0,
            credit: parseFloat(parts[4]) || 0,
            currency: parts[5] || "USD",
          };
        });
      }

      const prev = await fetchApi("/accounting/bank-statements/import-preview", {
        method: "POST",
        body: JSON.stringify({
          bank_account_id: selectedBankId,
          rows: parsedRows,
        }),
      });
      setPreviewResult(prev);
    } catch (err: any) {
      setError(err.message || "Failed to preview statement import.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!previewResult) return;
    try {
      setCommitting(true);
      setError(null);
      await fetchApi("/accounting/bank-statements/commit-import", {
        method: "POST",
        body: JSON.stringify({
          bank_account_id: selectedBankId,
          rows: previewResult.rows,
          create_missing_transactions: false,
        }),
      });
      setIsImportOpen(false);
      setPreviewResult(null);
      setRawCsvText("");
      await loadReconciliation();
    } catch (err: any) {
      setError(err.message || "Failed to commit statement import.");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider rounded-md uppercase bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
              AUDIT VERIFICATION
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Side-by-Side Bank Reconciliation
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Compare official bank statements against internal General Ledger transactions. Target Difference: $0.00.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadReconciliation}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Statement</span>
          </button>
        </div>
      </div>

      <BankingNav />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Difference Tracker Banner */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          {/* Account Selector */}
          <div className="w-full lg:w-72">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Bank Account
            </label>
            <select
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.bank_name} ({acc.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Statement Balance Input */}
          <div className="w-full lg:w-64">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Statement Closing Balance
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder={formatUSD(reconData?.balances.system_closing_balance || 0)}
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                className="w-full px-3 py-2 text-xs font-black rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
              <button
                onClick={loadReconciliation}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Set
              </button>
            </div>
          </div>

          {/* Three Balance Cards */}
          <div className="flex-1 grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <div className="text-[10px] uppercase font-bold text-slate-400">Statement Balance</div>
              <div className="text-base font-black text-slate-900 dark:text-white mt-1">
                {formatUSD(reconData?.balances.statement_closing_balance ?? 0)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <div className="text-[10px] uppercase font-bold text-slate-400">System Ledger Balance</div>
              <div className="text-base font-black text-slate-900 dark:text-white mt-1">
                {formatUSD(reconData?.balances.system_closing_balance ?? 0)}
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border ${
                reconData?.balances.is_reconciled
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300"
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider">
                {reconData?.balances.is_reconciled ? "STATUS: RECONCILED" : "UNRECONCILED DIFFERENCE"}
              </div>
              <div className="text-lg font-black mt-1">
                {formatUSD(reconData?.balances.difference ?? 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Manual Match Helper Bar */}
        {(selectedStmtLineId || selectedTxId) && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs bg-purple-50/50 dark:bg-purple-950/20 p-3 rounded-xl">
            <div className="flex items-center space-x-3">
              <span className="font-semibold text-purple-900 dark:text-purple-300">
                Selected:
              </span>
              <span>Statement Line #{selectedStmtLineId || "None"}</span>
              <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
              <span>Ledger Tx #{selectedTxId || "None"}</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setSelectedStmtLineId(null);
                  setSelectedTxId(null);
                }}
                className="px-2.5 py-1 text-[11px] rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium"
              >
                Clear
              </button>
              <button
                disabled={!selectedStmtLineId || !selectedTxId}
                onClick={() => handleMatchAction("MATCH", selectedStmtLineId!, selectedTxId!)}
                className="px-3.5 py-1 text-[11px] font-bold rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
              >
                Match Selected Pair
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Side-by-Side Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Statement Lines */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Imported Statement Lines ({reconData?.statement_lines?.length || 0})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Click row to select for matching</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[550px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-semibold uppercase sticky top-0 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Description / Ref</th>
                  <th className="py-2 px-3 text-right">Debit / Credit</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reconData?.statement_lines?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No statement lines imported for this account. Click "Import Statement" above.
                    </td>
                  </tr>
                ) : (
                  reconData?.statement_lines?.map((s) => {
                    const isSelected = selectedStmtLineId === s.id;
                    const isMatched = s.matched_status === "MATCHED";

                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedStmtLineId(s.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-purple-100/70 dark:bg-purple-950/50"
                            : isMatched
                            ? "bg-emerald-50/30 dark:bg-emerald-950/10 hover:bg-emerald-50/60"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">{s.date}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900 dark:text-white truncate max-w-[170px]">
                            {s.description}
                          </div>
                          {s.reference && (
                            <div className="text-[10px] font-mono text-slate-400 truncate max-w-[170px]">
                              {s.reference}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black whitespace-nowrap">
                          {s.debit > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">+{formatUSD(s.debit)}</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400">-{formatUSD(s.credit)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isMatched
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {s.matched_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {isMatched ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMatchAction("UNMATCH", s.id);
                              }}
                              className="p-1 rounded text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50"
                              title="Unmatch statement line"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-purple-600 font-semibold">Select</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Internal Ledger Transactions */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Landmark className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                System Ledger Transactions ({reconData?.ledger_transactions?.length || 0})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Click row to select for matching</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[550px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] font-semibold uppercase sticky top-0 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Code / Party</th>
                  <th className="py-2 px-3 text-right">USD Amount</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reconData?.ledger_transactions?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No transactions found for this account.
                    </td>
                  </tr>
                ) : (
                  reconData?.ledger_transactions?.map((t) => {
                    const isSelected = selectedTxId === t.id;
                    const isReconciled = t.status === "RECONCILED";

                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTxId(t.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-purple-100/70 dark:bg-purple-950/50"
                            : isReconciled
                            ? "bg-emerald-50/30 dark:bg-emerald-950/10 hover:bg-emerald-50/60"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">{t.date}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-white text-[11px] truncate max-w-[170px]">
                            {t.code}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                            {t.party_name}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black whitespace-nowrap">
                          {t.money_in > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">+{formatUSD(t.money_in)}</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400">-{formatUSD(t.money_out)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isReconciled
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span className="text-[10px] text-emerald-600 font-semibold">Select</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Statement Import Preview & Commit Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Import Bank Statement (CSV or JSON)
              </h2>
              <button
                onClick={() => {
                  setIsImportOpen(false);
                  setPreviewResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Paste Statement Rows (CSV: Date, Description, Reference, MoneyIn, MoneyOut, Currency)
                </label>
                <textarea
                  rows={5}
                  placeholder={`2026-03-01, Wire Transfer from Client, WT-99214, 50000.00, 0, USD\n2026-03-02, Bank Service Charge, CHG-001, 0, 45.00, USD`}
                  value={rawCsvText}
                  onChange={(e) => setRawCsvText(e.target.value)}
                  className="w-full font-mono text-[11px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  disabled={previewing || !rawCsvText.trim()}
                  onClick={handlePreviewImport}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold disabled:opacity-50"
                >
                  {previewing ? "Analyzing..." : "Analyze & Preview 6-State Classification"}
                </button>
              </div>

              {/* Preview Classification Results */}
              {previewResult && (
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold uppercase">Exact Match</div>
                      <div className="text-base font-black text-emerald-600">{previewResult.summary.exact_match}</div>
                    </div>
                    <div className="p-2 rounded bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800">
                      <div className="text-[10px] text-sky-800 dark:text-sky-300 font-bold uppercase">New Entry</div>
                      <div className="text-base font-black text-sky-600">{previewResult.summary.new}</div>
                    </div>
                    <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <div className="text-[10px] text-amber-800 dark:text-amber-300 font-bold uppercase">Duplicates</div>
                      <div className="text-base font-black text-amber-600">{previewResult.summary.duplicate}</div>
                    </div>
                    <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                      <div className="text-[10px] text-rose-800 dark:text-rose-300 font-bold uppercase">Invalid</div>
                      <div className="text-base font-black text-rose-600">{previewResult.summary.invalid}</div>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                        <tr>
                          <th className="py-1.5 px-2">Date</th>
                          <th className="py-1.5 px-2">Description</th>
                          <th className="py-1.5 px-2">Amount</th>
                          <th className="py-1.5 px-2">Classification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {previewResult.rows.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-1.5 px-2 font-mono">{r.date}</td>
                            <td className="py-1.5 px-2 truncate max-w-[180px]">{r.description}</td>
                            <td className="py-1.5 px-2 font-semibold">
                              {r.debit > 0 ? `+${r.debit}` : `-${r.credit}`}
                            </td>
                            <td className="py-1.5 px-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  r.status === "EXACT_MATCH"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : r.status === "NEW_TRANSACTION"
                                    ? "bg-sky-100 text-sky-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPreviewResult(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={committing}
                      onClick={handleCommitImport}
                      className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
                    >
                      {committing ? "Importing..." : "Commit Statement Import"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
