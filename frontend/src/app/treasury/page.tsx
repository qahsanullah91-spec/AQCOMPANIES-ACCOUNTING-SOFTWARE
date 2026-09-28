"use client";

import React, { useState, useEffect } from "react";
import {
  Wallet,
  Landmark,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  RefreshCw,
  Plus,
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { API_BASE } from "@/lib/api";

interface TreasuryAccount {
  id: number;
  company_id: number;
  company_name: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  account_type: string;
  currency: string;
  current_balance: number;
  current_balance_usd: number;
  status: string;
  branch?: string;
}

interface CurrencyPosition {
  currency: string;
  original_amount: number;
  usd_equivalent: number;
  fx_rate: number;
}

interface CompanyPosition {
  company_id: number;
  company_name: string;
  company_code: string;
  color_accent: string;
  total_usd: number;
  bank_count: number;
}

interface LiquidityMovement {
  id: number;
  transaction_code: string;
  date: string;
  company_name: string;
  bank_name: string;
  party_name: string;
  transaction_type: string;
  currency: string;
  money_in: number;
  money_out: number;
  usd_amount: number;
  is_in: boolean;
}

export default function CentralTreasuryPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("ALL");
  const [selectedCompany, setSelectedCompany] = useState<string>("ALL");
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Transfer Form State
  const [fromAccountId, setFromAccountId] = useState<number | "">("");
  const [toAccountId, setToAccountId] = useState<number | "">("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [transferPurpose, setTransferPurpose] = useState<string>("");
  const [transferRef, setTransferRef] = useState<string>("");

  const fetchTreasury = async () => {
    try {
      setLoading(true);
      const res = await fetch("${API_BASE}/treasury/overview");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching treasury overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreasury();
    const handleCompanyChange = () => fetchTreasury();
    window.addEventListener("aq_company_changed", handleCompanyChange);
    return () => window.removeEventListener("aq_company_changed", handleCompanyChange);
  }, []);

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || !transferAmount) return;

    try {
      setSubmitting(true);
      const res = await fetch("${API_BASE}/treasury/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_bank_account_id: fromAccountId,
          to_bank_account_id: toAccountId,
          amount: parseFloat(transferAmount),
          purpose: transferPurpose || "Central Treasury Liquidity Rebalance",
          reference: transferRef || `TRF-${Date.now().toString().slice(-6)}`,
          user_name: "Admin",
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setActionMessage(result.message || "Transfer executed successfully!");
        setTransferModalOpen(false);
        setFromAccountId("");
        setToAccountId("");
        setTransferAmount("");
        setTransferPurpose("");
        setTransferRef("");
        fetchTreasury();
      } else {
        alert(result.detail || "Transfer execution failed.");
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const accounts: TreasuryAccount[] = data?.accounts || [];
  const currencies: CurrencyPosition[] = data?.by_currency || [];
  const companies: CompanyPosition[] = data?.by_company || [];
  const movements: LiquidityMovement[] = data?.recent_movements || [];

  const filteredAccounts = accounts.filter((acc) => {
    if (selectedCurrency !== "ALL" && acc.currency !== selectedCurrency) return false;
    if (selectedCompany !== "ALL" && acc.company_id.toString() !== selectedCompany) return false;
    return true;
  });

  const fromAccObj = accounts.find((a) => a.id === fromAccountId);
  const toAccObj = accounts.find((a) => a.id === toAccountId);
  const isIntercompanyTransfer = fromAccObj && toAccObj && fromAccObj.company_id !== toAccObj.company_id;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AccountingNav />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">Central Treasury & Liquidity</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Multi-entity cash management, bank positions, and currency exposure
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchTreasury}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setTransferModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Transfer Money</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Total Group Cash</span>
            <Wallet className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ${data ? (data.total_group_cash_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "..."}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">100% Real Ledger</span>
            <span>• USD Equivalent</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Total Bank Balances</span>
            <Landmark className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ${data ? (data.total_bank_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "..."}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Commercial & Trade Bank Accounts
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Physical Cash Vaults</span>
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ${data ? (data.total_cash_vault_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "..."}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Kabul & Dubai Office Vaults
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Sarafi / Hawala Balances</span>
            <ArrowRightLeft className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ${data ? (data.total_sarafi_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "..."}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Trade settlement broker balances
          </div>
        </div>
      </div>

      {/* Multi-Currency Exposure Strip */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
          <Coins className="w-4 h-4 text-amber-500" />
          <span>Currency Positions (Actual Holdings & USD Equivalence)</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {currencies.map((c) => (
            <div
              key={c.currency}
              className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  {c.currency}
                </span>
                <span className="text-[10px] text-slate-400">
                  {c.currency === "USD" ? "Base Currency" : `FX Rate: ${c.fx_rate}`}
                </span>
              </div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white">
                {c.original_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {c.currency}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                ≈ ${c.usd_equivalent.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cash Position By Company Entity */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-sky-500" />
          <span>Cash Position by Company Entity</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {companies.map((comp) => {
            const totalGroup = data?.total_group_cash_usd || 1;
            const pct = ((comp.total_usd / totalGroup) * 100).toFixed(1);
            return (
              <div
                key={comp.company_id}
                className="p-4 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: comp.color_accent || "#2563eb" }}
                />
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  <span>{comp.company_name}</span>
                  <span className="font-mono text-[10px] text-slate-400">{comp.company_code}</span>
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  ${comp.total_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>{comp.bank_count} Bank Account{comp.bank_count !== 1 ? "s" : ""}</span>
                  <span className="font-semibold text-sky-600 dark:text-sky-400">{pct}% of Group</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bank & Cash Accounts List with Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">All Bank & Cash Accounts</h2>
            <p className="text-[11px] text-slate-500">Live operational ledger accounts segregated by company entity</p>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Companies</option>
              {companies.map((c) => (
                <option key={c.company_id} value={c.company_id}>
                  {c.company_name}
                </option>
              ))}
            </select>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Currencies</option>
              <option value="USD">USD</option>
              <option value="AFN">AFN</option>
              <option value="AED">AED</option>
              <option value="INR">INR</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Entity</th>
                <th className="py-2.5 px-4">Account Name / Bank</th>
                <th className="py-2.5 px-4">Account No / Type</th>
                <th className="py-2.5 px-4">Branch</th>
                <th className="py-2.5 px-4 text-right">Balance (Original)</th>
                <th className="py-2.5 px-4 text-right">Balance (USD)</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                    No accounts match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {acc.company_name}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{acc.account_name}</div>
                      <div className="text-[10px] text-slate-400">{acc.bank_name}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-mono text-slate-700 dark:text-slate-300">{acc.account_number}</div>
                      <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {acc.account_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px]">{acc.branch || "—"}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {acc.current_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} {acc.currency}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-sky-600 dark:text-sky-400">
                      ${acc.current_balance_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                        {acc.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Liquidity Movement Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Liquidity Movement (Last 30 Days)</h2>
          <p className="text-[11px] text-slate-500">Cross-company deposit, wire disbursement, and transfer audit trail</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Entity</th>
                <th className="py-2.5 px-4">Counterparty / Description</th>
                <th className="py-2.5 px-4">Bank Account</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4 text-right">Flow (Original)</th>
                <th className="py-2.5 px-4 text-right">USD Equivalent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                    No recent transactions in the last 30 days.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">{m.date}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{m.company_name}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{m.party_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.transaction_code}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{m.bank_name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {m.transaction_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      {m.is_in ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-end space-x-1">
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          <span>+{m.money_in.toLocaleString(undefined, { minimumFractionDigits: 2 })} {m.currency}</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center justify-end space-x-1">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>-{m.money_out.toLocaleString(undefined, { minimumFractionDigits: 2 })} {m.currency}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ${m.usd_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Money Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Treasury Transfer</h3>
              </div>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Source Account (From)
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select source account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.company_name}] {a.account_name} — {a.current_balance.toLocaleString()} {a.currency}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Account (To)
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select destination account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.id === fromAccountId}>
                      [{a.company_name}] {a.account_name} — {a.current_balance.toLocaleString()} {a.currency}
                    </option>
                  ))}
                </select>
              </div>

              {isIntercompanyTransfer && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Intercompany Transfer Detected:</span> Source ({fromAccObj?.company_name}) and Destination ({toAccObj?.company_name}) belong to different entities. Dual-sided balanced journal entries (Dr 1370 / Cr Bank and Dr Bank / Cr 2350) will be automatically posted.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Reference</label>
                  <input
                    type="text"
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    placeholder="e.g. WIRE-88192"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Purpose / Notes</label>
                <input
                  type="text"
                  value={transferPurpose}
                  onChange={(e) => setTransferPurpose(e.target.value)}
                  placeholder="e.g. Working capital replenishment"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? "Executing..." : "Execute Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
