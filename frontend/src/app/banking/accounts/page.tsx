"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Landmark,
  Plus,
  Edit2,
  CheckCircle2,
  Layers,
  ArrowLeftRight,
  RefreshCw,
  Building2,
  Wallet,
  X,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { BankingNav } from "@/components/BankingNav";

interface BankAccount {
  id: number;
  bank_name: string;
  account_name: string;
  account_number: string;
  account_type: string;
  currency: string;
  opening_balance: number;
  opening_balance_date: string | null;
  current_balance: number;
  available_balance: number;
  iban: string | null;
  swift: string | null;
  branch: string | null;
  status: string;
  notes: string | null;
}

export default function BankAccountsMasterPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("AQ COMPANIES");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("BANK");
  const [currency, setCurrency] = useState("USD");
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingBalanceDate, setOpeningBalanceDate] = useState("2026-01-01");
  const [iban, setIban] = useState("");
  const [swift, setSwift] = useState("");
  const [branch, setBranch] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit Modal
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi<BankAccount[]>("/accounting/banks");
      setAccounts(res || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load bank accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await fetchApi("/accounting/banks", {
        method: "POST",
        body: JSON.stringify({
          bank_name: bankName,
          account_name: accountName,
          account_number: accountNumber,
          account_type: accountType,
          currency,
          opening_balance: openingBalance,
          opening_balance_date: openingBalanceDate,
          iban: iban || null,
          swift: swift || null,
          branch: branch || null,
          notes: notes || null,
        }),
      });
      setIsCreateOpen(false);
      resetForm();
      await loadAccounts();
    } catch (err: any) {
      setError(err.message || "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      setSubmitting(true);
      setError(null);
      await fetchApi(`/accounting/banks/${editingAccount.id}`, {
        method: "PUT",
        body: JSON.stringify({
          bank_name: editingAccount.bank_name,
          account_name: editingAccount.account_name,
          account_type: editingAccount.account_type,
          iban: editingAccount.iban,
          swift: editingAccount.swift,
          branch: editingAccount.branch,
          status: editingAccount.status,
          notes: editingAccount.notes,
        }),
      });
      setEditingAccount(null);
      await loadAccounts();
    } catch (err: any) {
      setError(err.message || "Failed to update account.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setBankName("");
    setAccountName("AQ COMPANIES");
    setAccountNumber("");
    setAccountType("BANK");
    setCurrency("USD");
    setOpeningBalance(0);
    setOpeningBalanceDate("2026-01-01");
    setIban("");
    setSwift("");
    setBranch("");
    setNotes("");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider rounded-md uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              MASTER DATA
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Bank Accounts Master
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure multi-currency commercial banks, cash vaults, and Sarafi broker balances.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadAccounts}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Bank / Cash Account</span>
          </button>
        </div>
      </div>

      <BankingNav />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      acc.account_type === "SARAFI"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        : acc.account_type === "CASH"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                    }`}
                  >
                    {acc.account_type} • {acc.currency}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-2">
                    {acc.bank_name}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {acc.account_name}
                  </div>
                </div>

                <button
                  onClick={() => setEditingAccount(acc)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span className="text-slate-400">Account No:</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{acc.account_number}</span>
                </div>
                {acc.iban && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">IBAN:</span>
                    <span className="font-mono text-[11px] truncate max-w-[180px]">{acc.iban}</span>
                  </div>
                )}
                {acc.swift && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">SWIFT:</span>
                    <span className="font-mono text-[11px]">{acc.swift}</span>
                  </div>
                )}
                {acc.branch && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Branch:</span>
                    <span>{acc.branch}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Running Balance</div>
                <div className="text-xl font-black text-slate-900 dark:text-white">
                  {acc.currency === "USD"
                    ? formatUSD(acc.current_balance)
                    : `${acc.currency} ${acc.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>

              <Link
                href={`/banking/transactions?bank_account_id=${acc.id}`}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                View Ledger
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Create Account Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Add Bank / Cash / Sarafi Account
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Account Type *
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="BANK">Commercial Bank</option>
                    <option value="CASH">Physical Cash Vault</option>
                    <option value="SARAFI">Sarafi / Hawala Desk</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Currency *
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="USD">USD — US Dollar (Base)</option>
                    <option value="AFN">AFN — Afghan Afghani</option>
                    <option value="AED">AED — UAE Dirham</option>
                    <option value="INR">INR — Indian Rupee</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Bank / Desk Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Afghan United Bank / Omid Ehsan Sarafi"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AUB-USD-00129"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Opening Date
                  </label>
                  <input
                    type="date"
                    value={openingBalanceDate}
                    onChange={(e) => setOpeningBalanceDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    IBAN (Optional)
                  </label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    SWIFT / BIC (Optional)
                  </label>
                  <input
                    type="text"
                    value={swift}
                    onChange={(e) => setSwift(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Branch / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shahre Naw, Kabul / Deira, Dubai"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Edit Bank Account Master
              </h2>
              <button
                onClick={() => setEditingAccount(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Bank / Desk Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingAccount.bank_name}
                  onChange={(e) => setEditingAccount({ ...editingAccount, bank_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAccount.account_name}
                    onChange={(e) => setEditingAccount({ ...editingAccount, account_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Status
                  </label>
                  <select
                    value={editingAccount.status}
                    onChange={(e) => setEditingAccount({ ...editingAccount, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="FROZEN">FROZEN</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    IBAN
                  </label>
                  <input
                    type="text"
                    value={editingAccount.iban || ""}
                    onChange={(e) => setEditingAccount({ ...editingAccount, iban: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    SWIFT / BIC
                  </label>
                  <input
                    type="text"
                    value={editingAccount.swift || ""}
                    onChange={(e) => setEditingAccount({ ...editingAccount, swift: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Branch / Location
                </label>
                <input
                  type="text"
                  value={editingAccount.branch || ""}
                  onChange={(e) => setEditingAccount({ ...editingAccount, branch: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editingAccount.notes || ""}
                  onChange={(e) => setEditingAccount({ ...editingAccount, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
