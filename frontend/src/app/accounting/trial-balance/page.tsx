"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Calendar,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";
import {
  PdfDownloadButton,
  PrintButton,
  MoneyDisplay,
} from "@/components/accounting";

interface TrialBalanceAccount {
  account_code: string;
  account_name: string;
  account_type: string;
  sub_type: string | null;
  total_debit_activity: number;
  total_credit_activity: number;
  debit_balance: number;
  credit_balance: number;
}

export default function TrialBalanceReportPage() {
  const [data, setData] = useState<any>(null);
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);

  const loadData = async (dateVal: string) => {
    try {
      setLoading(true);
      const res = await fetchApi(`/accounting/trial-balance?as_of_date=${dateVal}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(asOfDate);
  }, []);

  const accounts: TrialBalanceAccount[] = data?.accounts || [];
  const isBalanced = data?.is_balanced;
  const totalDebit = data?.total_debit || 0;
  const totalCredit = data?.total_credit || 0;
  const diff = data?.difference || 0;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Layers className="w-7 h-7 text-sky-600" />
            Double-Entry Trial Balance
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • General Ledger Balances & Mathematical Double-Entry Validation
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs mr-2">
            <label className="font-semibold text-slate-600 dark:text-slate-300">As of:</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => {
                setAsOfDate(e.target.value);
                loadData(e.target.value);
              }}
              className="input py-1 text-xs"
            />
          </div>
          <PdfDownloadButton
            url={`/api/v1/accounting/trial-balance.pdf?as_of_date=${asOfDate}`}
            filename={`AQ-Trial-Balance-${asOfDate}.pdf`}
            label="Download PDF"
            size="sm"
          />
          <PrintButton label="Print" size="sm" />
        </div>
      </div>

      <AccountingNav />

      {/* Accounting Balance Check Alert */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs ${
          isBalanced
            ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
            : "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
        }`}
      >
        <div className="flex items-center space-x-3">
          {isBalanced ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <div>
            <span className="font-bold">
              {isBalanced
                ? "TRIAL BALANCE IS IN PERFECT BALANCE (Zero Variance)"
                : "OUT OF BALANCE: DISCREPANCY DETECTED"}
            </span>
            <div className="text-[11px] opacity-80 mt-0.5">
              Total Debits = {formatUSD(totalDebit)} | Total Credits = {formatUSD(totalCredit)} | Difference = {formatUSD(diff)}
            </div>
          </div>
        </div>
        <span
          className={`badge px-3 py-1 font-bold ${
            isBalanced ? "badge-success" : "badge-danger"
          }`}
        >
          {isBalanced ? "BALANCED" : "ERROR"}
        </span>
      </div>

      {/* Trial Balance Report Table (Desktop) */}
      <div className="hidden md:block table-container shadow-2xs">
        <table className="table">
          <thead>
            <tr>
              <th className="w-24">Code</th>
              <th>Account Title</th>
              <th>Type</th>
              <th>Classification</th>
              <th className="text-right w-44">Debit Balance (USD)</th>
              <th className="text-right w-44">Credit Balance (USD)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                  Calculating Trial Balance...
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                  No account activity posted.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.account_code} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {a.account_code}
                  </td>
                  <td>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {a.account_name}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-neutral text-[9px]">
                      {a.account_type}
                    </span>
                  </td>
                  <td className="text-slate-500 text-xs">
                    {a.sub_type || "Standard"}
                  </td>
                  <td className="text-right font-mono text-xs">
                    {a.debit_balance > 0 ? <MoneyDisplay amount={a.debit_balance} /> : "—"}
                  </td>
                  <td className="text-right font-mono text-xs">
                    {a.credit_balance > 0 ? <MoneyDisplay amount={a.credit_balance} /> : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900 font-bold text-xs">
            <tr>
              <td colSpan={4} className="py-2.5 px-4 uppercase tracking-wider text-slate-900 dark:text-slate-100">
                TOTAL DEBIT:
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-sm text-slate-900 dark:text-white">
                <MoneyDisplay amount={totalDebit} />
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-400">
                —
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="py-2.5 px-4 uppercase tracking-wider text-slate-900 dark:text-slate-100">
                TOTAL CREDIT:
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-400">
                —
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-sm text-slate-900 dark:text-white">
                <MoneyDisplay amount={totalCredit} />
              </td>
            </tr>
            <tr className={diff === 0 ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20" : "text-rose-700 dark:text-rose-300 bg-rose-50/40 dark:bg-rose-950/20"}>
              <td colSpan={4} className="py-2.5 px-4 uppercase tracking-wider font-black">
                DIFFERENCE:
              </td>
              <td colSpan={2} className="py-2.5 px-4 text-right font-mono text-sm font-black">
                {diff === 0 ? "$0.00 (BALANCED)" : formatUSD(diff)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile Account Hierarchy Cards (iPhone / Small Viewports) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs card">
            Calculating Trial Balance...
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs card">
            No account activity posted.
          </div>
        ) : (
          accounts.map((a) => (
            <div
              key={a.account_code}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">
                    {a.account_name}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 mt-0.5">
                    Account: <span className="font-bold text-slate-700 dark:text-slate-300">{a.account_code}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="badge badge-neutral text-[9px] uppercase">
                    {a.account_type}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                    Debit
                  </span>
                  <div className={`font-black ${a.debit_balance > 0 ? "text-sky-600 dark:text-sky-400" : "text-slate-400"}`}>
                    {a.debit_balance > 0 ? formatUSD(a.debit_balance) : "—"}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                    Credit
                  </span>
                  <div className={`font-black ${a.credit_balance > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                    {a.credit_balance > 0 ? formatUSD(a.credit_balance) : "—"}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Mobile Sticky / Persistent Totals Summary Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md space-y-2 text-xs">
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Total Debits:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{formatUSD(totalDebit)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Total Credits:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{formatUSD(totalCredit)}</span>
          </div>
          <div className={`flex justify-between items-center pt-2 border-t-2 font-mono font-black ${
            diff === 0 ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-rose-500 text-rose-600 dark:text-rose-400"
          }`}>
            <span className="uppercase text-[11px]">Difference:</span>
            <span>{diff === 0 ? "$0.00 (BALANCED)" : formatUSD(diff)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
