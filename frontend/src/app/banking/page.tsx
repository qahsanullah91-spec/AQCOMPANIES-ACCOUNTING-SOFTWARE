"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Landmark,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Scale,
  ShieldCheck,
  Building2,
  Truck,
  ArrowLeftRight,
  Receipt,
  Wallet,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Upload,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { BankingNav } from "@/components/BankingNav";

interface BankAccountCard {
  id: number;
  bank_name: string;
  account_number: string;
  account_type: string;
  currency: string;
  balance: number;
  balance_usd_est: number;
  status: string;
  branch: string | null;
}

interface BankingDashboardData {
  currency_balances: {
    USD: number;
    AFN: number;
    AED: number;
    INR: number;
  };
  total_cash_and_bank_usd_est: number;
  cash_flow: {
    as_of_date: string;
    opening_cash: number;
    money_in: {
      customer_receipts: number;
      other_income: number;
      total_in: number;
    };
    money_out: {
      supplier_payments: number;
      transport_payments: number;
      expenses: number;
      bank_charges: number;
      total_out: number;
    };
    net_cash_flow: number;
    closing_cash: number;
  };
  carrier_credit_position: {
    total_freight_charges: number;
    total_payments: number;
    total_opening_credit: number;
    net_balance: number;
    carrier_credit_in_our_favor: number;
    has_carrier_credit: boolean;
    status: string;
  };
  reconciliation_summary: {
    total_transactions: number;
    reconciled: number;
    unreconciled: number;
    reconciliation_rate_pct: number;
  };
  accounts: BankAccountCard[];
}

export default function BankingHubPage() {
  const [data, setData] = useState<BankingDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi<BankingDashboardData>("/accounting/banking-dashboard");
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load banking dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider rounded-md uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              OPERATIONAL
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Banking & Treasury Hub
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authoritative multi-currency bank accounts, cash vaults, Sarafi broker balances, and carrier credit.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadDashboard}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/banking/transactions"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Universal Ledger</span>
          </Link>
        </div>
      </div>

      {/* Navigation Submenu */}
      <BankingNav />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Carrier Credit Callout Banner */}
      {data?.carrier_credit_position && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-300 dark:border-emerald-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Carrier Standing Verified
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100">
                  CREDIT IN AQ FAVOR
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Freight Incurred: <strong>{formatUSD(data.carrier_credit_position.total_freight_charges)}</strong> • Payments Disbursed: <strong>{formatUSD(data.carrier_credit_position.total_payments)}</strong> • Opening Credit: <strong>{formatUSD(data.carrier_credit_position.total_opening_credit)}</strong>
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Carrier Credit in AQ Favor</div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {formatUSD(data.carrier_credit_position.carrier_credit_in_our_favor)}
            </div>
            <Link
              href="/transport/account"
              className="text-[11px] text-emerald-700 dark:text-emerald-300 hover:underline font-semibold inline-flex items-center gap-1 mt-0.5"
            >
              <span>View Carrier Ledger</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Multi-Currency Balances Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* USD Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider">USD Total</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
              BASE
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {formatUSD(data?.currency_balances?.USD ?? 0)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Settlement wires & cash vault
          </div>
        </div>

        {/* AFN Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider">AFN Total</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
              AFGHANI
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            ؋{(data?.currency_balances?.AFN ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            AUB AFN & Omid Ehsan Sarafi
          </div>
        </div>

        {/* AED Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider">AED Total</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              DIRHAM
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            AED {(data?.currency_balances?.AED ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Emirates NBD Trade Desk
          </div>
        </div>

        {/* INR Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider">INR Total</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              RUPEE
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            ₹{(data?.currency_balances?.INR ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            HDFC Trade & INR Settlement
          </div>
        </div>
      </div>

      {/* Quick Action Workbench Buttons */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
          Quick Payment Workbenches
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/receivables/payments"
            className="flex items-center space-x-2.5 p-3 rounded-lg bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800/60 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700/60 transition-colors"
          >
            <div className="w-8 h-8 rounded-md bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ArrowDownRight className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Customer Receipt</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Auto-allocation & advance</div>
            </div>
          </Link>

          <Link
            href="/payables"
            className="flex items-center space-x-2.5 p-3 rounded-lg bg-slate-50 hover:bg-sky-50 dark:bg-slate-800/60 dark:hover:bg-sky-950/30 border border-slate-200 dark:border-slate-700/60 transition-colors"
          >
            <div className="w-8 h-8 rounded-md bg-sky-600/10 text-sky-600 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Supplier Payment</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">PO wire & 1350 advance</div>
            </div>
          </Link>

          <Link
            href="/transport/account"
            className="flex items-center space-x-2.5 p-3 rounded-lg bg-slate-50 hover:bg-amber-50 dark:bg-slate-800/60 dark:hover:bg-amber-950/30 border border-slate-200 dark:border-slate-700/60 transition-colors"
          >
            <div className="w-8 h-8 rounded-md bg-amber-600/10 text-amber-600 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Transport Payment</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Sky Ariana credit check</div>
            </div>
          </Link>

          <Link
            href="/banking/reconciliation"
            className="flex items-center space-x-2.5 p-3 rounded-lg bg-slate-50 hover:bg-purple-50 dark:bg-slate-800/60 dark:hover:bg-purple-950/30 border border-slate-200 dark:border-slate-700/60 transition-colors"
          >
            <div className="w-8 h-8 rounded-md bg-purple-600/10 text-purple-600 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Bank Reconcile</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">$0.00 difference tracker</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Bank Account Master List */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Bank, Cash Vault & Sarafi Accounts Master
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Authoritative running balance computed from chronological double-entry transactions
            </p>
          </div>
          <Link
            href="/banking/accounts"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Manage Accounts →
          </Link>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Account Name & Bank</th>
                <th className="py-3 px-4">Account Number</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Currency</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
                <th className="py-3 px-4 text-right">USD Est.</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {data?.accounts?.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    <div>{acc.bank_name}</div>
                    <div className="text-[11px] text-slate-500 font-normal">{acc.branch || "Headquarters"}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {acc.account_number}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        acc.account_type === "SARAFI"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          : acc.account_type === "CASH"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                      }`}
                    >
                      {acc.account_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold">{acc.currency}</td>
                  <td className="py-3 px-4 text-right font-black">
                    {acc.currency === "USD"
                      ? formatUSD(acc.balance)
                      : `${acc.currency} ${acc.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-500 dark:text-slate-400">
                    {formatUSD(acc.balance_usd_est)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{acc.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/banking/transactions?bank_account_id=${acc.id}`}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      Ledger
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Banking Home View (Req 18: Top Bank, Cash, Sarafi + Account Cards) */}
        <div className="md:hidden space-y-3 p-3">
          {/* Top Overview: Total Bank, Cash, Sarafi (Req 18) */}
          <div className="grid grid-cols-3 gap-2 pb-1">
            {/* Total Bank */}
            <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/20 border border-sky-500/20 text-center">
              <div className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400">Total Bank</div>
              <div className="text-sm font-black text-sky-700 dark:text-sky-300 mt-0.5 truncate">
                {formatUSD(
                  data?.accounts
                    ?.filter((a) => a.account_type === "BANK")
                    ?.reduce((sum, a) => sum + (a.balance_usd_est || a.balance || 0), 0) || 0
                )}
              </div>
            </div>

            {/* Total Cash */}
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20 text-center">
              <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Total Cash</div>
              <div className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
                {formatUSD(
                  data?.accounts
                    ?.filter((a) => a.account_type === "CASH")
                    ?.reduce((sum, a) => sum + (a.balance_usd_est || a.balance || 0), 0) || 0
                )}
              </div>
            </div>

            {/* Total Sarafi */}
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-500/20 text-center">
              <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Total Sarafi</div>
              <div className="text-sm font-black text-amber-700 dark:text-amber-300 mt-0.5 truncate">
                {formatUSD(
                  data?.accounts
                    ?.filter((a) => a.account_type === "SARAFI")
                    ?.reduce((sum, a) => sum + (a.balance_usd_est || a.balance || 0), 0) || 0
                )}
              </div>
            </div>
          </div>

          <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1 pt-1">
            Accounts & Vaults List
          </div>

          {data?.accounts?.map((acc) => (
            <div
              key={acc.id}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {acc.bank_name}
                  </h3>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {acc.branch || "Headquarters"} • <span className="font-mono">{acc.account_number}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      acc.account_type === "SARAFI"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        : acc.account_type === "CASH"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                    }`}
                  >
                    {acc.account_type}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                    {acc.currency}
                  </span>
                </div>
              </div>

              <div className="pt-1 space-y-2.5">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Balance</div>
                  <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                    {acc.currency === "USD"
                      ? formatUSD(acc.balance)
                      : `${acc.currency} ${acc.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </div>
                  {acc.currency !== "USD" && (
                    <div className="text-[11px] font-mono text-slate-500">
                      ≈ {formatUSD(acc.balance_usd_est)}
                    </div>
                  )}
                </div>

                {/* Today In / Out & Unreconciled Count */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Today In:</span>
                    <span className="text-emerald-600 font-bold">+$0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Today Out:</span>
                    <span className="text-rose-600 font-bold">-$0.00</span>
                  </div>
                  <div className="col-span-2 flex justify-between border-t border-slate-200 dark:border-slate-700/60 pt-1 text-[10px] uppercase">
                    <span className="text-slate-400">Unreconciled:</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      {data?.reconciliation_summary?.unreconciled || 0} Transactions
                    </span>
                  </div>
                </div>

                {/* Quick actions inside card */}
                <div className="flex items-center gap-1.5 pt-1">
                  <Link
                    href={`/banking/reconciliation?account_id=${acc.id}`}
                    className="flex-1 px-2.5 py-2 text-[11px] font-bold rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 min-h-[40px] flex items-center justify-center gap-1"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Match</span>
                  </Link>
                  <Link
                    href={`/banking/accounts?action=import&account_id=${acc.id}`}
                    className="flex-1 px-2.5 py-2 text-[11px] font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 min-h-[40px] flex items-center justify-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-600" />
                    <span>Import</span>
                  </Link>
                  <Link
                    href={`/banking/transactions?action=transfer&from_account=${acc.id}`}
                    className="flex-1 px-2.5 py-2 text-[11px] font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 min-h-[40px] flex items-center justify-center gap-1"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Transfer</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
