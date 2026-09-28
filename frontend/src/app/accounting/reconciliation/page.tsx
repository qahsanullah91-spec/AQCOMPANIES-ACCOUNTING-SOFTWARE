"use client";

import React, { useState, useEffect } from "react";
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  Search,
  Check,
  X,
  RefreshCw,
  Landmark,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  currency: string;
}

interface ReconciliationTx {
  id: number;
  code: string;
  date: string;
  party_name: string;
  type: string;
  money_in: number;
  money_out: number;
  reference: string | null;
  status: string;
  notes: string | null;
}

export default function BankReconciliationPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number>(1);
  const [statementBalance, setStatementBalance] = useState<number>(-1030000.0);
  const [recData, setRecData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (bId: number, stmtBal: number) => {
    try {
      setLoading(true);
      const res = await fetchApi(
        `/accounting/reconciliation/${bId}?statement_closing_balance=${stmtBal}`
      );
      setRecData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const banks = await fetchApi<BankAccount[]>("/accounting/banks");
        setBankAccounts(banks || []);
        if (banks && banks.length > 0) {
          setSelectedBankId(banks[0].id);
          loadData(banks[0].id, statementBalance);
        }
      } catch (err) {
        console.error(err);
      }
    }
    init();
  }, []);

  const handleBankChange = (id: number) => {
    setSelectedBankId(id);
    loadData(id, statementBalance);
  };

  const handleStatementBalChange = (val: number) => {
    setStatementBalance(val);
    loadData(selectedBankId, val);
  };

  const handleMatchTx = async (txId: number, newStatus: string) => {
    try {
      await fetchApi("/accounting/reconciliation/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: txId,
          status: newStatus,
          user_name: "Admin",
        }),
      });
      await loadData(selectedBankId, statementBalance);
    } catch (err: any) {
      alert(err.message || "Failed to update match status.");
    }
  };

  const balances = recData?.balances || {};
  const transactions: ReconciliationTx[] = recData?.transactions || [];
  const isReconciled = Math.abs(balances.difference || 0) < 0.01;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Scale className="w-7 h-7 text-sky-600" />
            Bank Statement Reconciliation Workbench
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Compare System Bank Ledger vs Official Monthly Bank Statements
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedBankId}
            onChange={(e) => handleBankChange(parseInt(e.target.value))}
            className="select text-xs font-bold"
          >
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bank_name} ({b.currency})
              </option>
            ))}
          </select>
        </div>
      </div>

      <AccountingNav />

      {/* Difference & Reconciliation Monitor Bar */}
      <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Closing Balance Reconciliation
            </h2>
            <p className="text-[11px] text-slate-400">
              Enter official statement closing balance from PDF/paper statement to verify zero variance.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <label className="text-xs font-semibold">Statement Closing Balance ($):</label>
            <input
              type="number"
              step="0.01"
              value={statementBalance}
              onChange={(e) => handleStatementBalChange(parseFloat(e.target.value) || 0)}
              className="input font-mono font-bold text-sm w-44 text-right"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center font-mono">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500">System Ledger Balance</span>
            <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
              {formatUSD(balances.system_closing_balance)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500">Statement Closing Balance</span>
            <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
              {formatUSD(balances.statement_closing_balance)}
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              isReconciled
                ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                : "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
            }`}
          >
            <span className="text-[10px] font-bold">Unreconciled Variance / Difference</span>
            <div className="text-lg font-black mt-0.5 flex items-center justify-center">
              {isReconciled ? (
                <span className="flex items-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5 mr-1" /> $0.00 (RECONCILED)
                </span>
              ) : (
                <span className="flex items-center text-rose-600">
                  <AlertTriangle className="w-5 h-5 mr-1" /> {formatUSD(balances.difference)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Matching Grid */}
      <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden space-y-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              System Transactions to Match
            </h3>
            <p className="text-[11px] text-slate-500">
              Review and mark individual transactions as RECONCILED, UNMATCHED, or POSSIBLE MATCH.
            </p>
          </div>
          <span className="text-xs text-slate-500">
            {transactions.length} transactions in account
          </span>
        </div>

        <div className="table-container border-0 rounded-none">
          <table className="table">
            <thead>
              <tr>
                <th className="w-24">Date</th>
                <th className="w-28">TX Code</th>
                <th>Party / Description</th>
                <th>Type</th>
                <th>Reference</th>
                <th className="text-right w-28">Money In ($)</th>
                <th className="text-right w-28">Money Out ($)</th>
                <th className="text-center w-28">Match Status</th>
                <th className="text-center w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                    Loading reconciliation transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                    No transactions found for this bank account.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                      {t.date}
                    </td>
                    <td className="font-mono font-bold text-sky-600 dark:text-sky-400 text-[11px]">
                      {t.code}
                    </td>
                    <td>
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {t.party_name}
                      </div>
                      {t.notes && <div className="text-[10px] text-slate-400">{t.notes}</div>}
                    </td>
                    <td>
                      <span className="badge badge-neutral text-[9px] font-mono">
                        {t.type}
                      </span>
                    </td>
                    <td className="font-mono text-slate-500 text-[11px]">
                      {t.reference || "—"}
                    </td>
                    <td className="text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      {t.money_in > 0 ? formatUSD(t.money_in) : "—"}
                    </td>
                    <td className="text-right font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                      {t.money_out > 0 ? formatUSD(t.money_out) : "—"}
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge text-[9px] font-mono ${
                          t.status === "RECONCILED"
                            ? "badge-success"
                            : t.status === "MATCHED"
                            ? "badge-info"
                            : "badge-warning"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="text-center">
                      {t.status !== "RECONCILED" ? (
                        <button
                          onClick={() => handleMatchTx(t.id, "RECONCILED")}
                          className="btn btn-primary py-0.5 px-2 text-[10px] font-bold"
                        >
                          Match & Clear
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMatchTx(t.id, "CLEARED")}
                          className="text-[10px] text-slate-400 hover:text-rose-600 underline"
                        >
                          Unmatch
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
