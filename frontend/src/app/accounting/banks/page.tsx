"use client";

import React, { useState, useEffect } from "react";
import {
  Landmark,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  DollarSign,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface BankAccount {
  id: number;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  opening_balance: number;
  current_balance: number;
  swift_iban: string | null;
  branch: string | null;
  notes: string | null;
}

interface BankTransaction {
  id: number;
  transaction_code: string;
  date: string;
  bank_account_id: number;
  bank_name: string;
  account_number: string;
  party_type: string;
  party_name: string;
  transaction_type: string;
  currency: string;
  money_in: number;
  money_out: number;
  exchange_rate: number;
  usd_equivalent_in: number;
  usd_equivalent_out: number;
  running_balance: number;
  transaction_reference: string | null;
  status: string;
  notes: string | null;
  created_by: string;
}

export default function BankLedgerManagementPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Record Transaction Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [modalBankId, setModalBankId] = useState<number>(1);
  const [txType, setTxType] = useState("CUSTOMER_RECEIPT");
  const [partyType, setPartyType] = useState("CUSTOMER");
  const [partyName, setPartyName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [originalAmount, setOriginalAmount] = useState<number>(0);
  const [fxRate, setFxRate] = useState<number>(1.0);
  const [txDirection, setTxDirection] = useState<"IN" | "OUT">("IN");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accs, txs] = await Promise.all([
        fetchApi<BankAccount[]>("/accounting/banks"),
        fetchApi<BankTransaction[]>("/accounting/bank-transactions"),
      ]);
      setBankAccounts(accs || []);
      setTransactions(txs || []);
      if (accs && accs.length > 0 && !modalBankId) {
        setModalBankId(accs[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalBankBalance = bankAccounts.reduce(
    (sum, a) => sum + (a.current_balance || 0),
    0
  );

  const filtered = transactions.filter((t) => {
    const matchesBank =
      selectedBankId === "ALL" || String(t.bank_account_id) === selectedBankId;
    const s = search.toLowerCase();
    const matchesSearch =
      t.party_name.toLowerCase().includes(s) ||
      t.transaction_code.toLowerCase().includes(s) ||
      (t.transaction_reference && t.transaction_reference.toLowerCase().includes(s)) ||
      (t.notes && t.notes.toLowerCase().includes(s));

    return matchesBank && matchesSearch;
  });

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (originalAmount <= 0) {
      setErrorMsg("Amount must be greater than zero.");
      return;
    }
    setErrorMsg(null);

    const mIn = txDirection === "IN" ? originalAmount : 0;
    const mOut = txDirection === "OUT" ? originalAmount : 0;

    try {
      await fetchApi("/accounting/bank-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_account_id: modalBankId,
          transaction_type: txType,
          party_type: partyType,
          party_name: partyName || "General Party",
          currency,
          money_in: mIn,
          money_out: mOut,
          exchange_rate: fxRate,
          date: txDate,
          transaction_reference: reference,
          notes,
          created_by: "Admin",
        }),
      });

      setIsModalOpen(false);
      setPartyName("");
      setOriginalAmount(0);
      setReference("");
      setNotes("");
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record transaction.");
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Landmark className="w-7 h-7 text-sky-600" />
            Bank Ledger & Multi-Bank Management
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Multi-Currency Vaults (USD, AED, AFN, INR) • Live Balances
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>+ Record Bank Transaction</span>
        </button>
      </div>

      <AccountingNav />

      {/* Multi-Currency Bank Account Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {bankAccounts.map((b) => (
          <div
            key={b.id}
            onClick={() => setSelectedBankId(selectedBankId === String(b.id) ? "ALL" : String(b.id))}
            className={`card p-4 transition-all cursor-pointer select-none ${
              selectedBankId === String(b.id)
                ? "border-sky-500 ring-2 ring-sky-500/20 shadow-md"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="badge badge-info text-[9px] font-mono font-bold">
                {b.currency}
              </span>
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                {b.account_number}
              </span>
            </div>

            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-2 truncate">
              {b.bank_name}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {b.branch || b.account_name}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Balance:</span>
              <span
                className={`font-mono font-black text-sm ${
                  b.current_balance < 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"
                }`}
              >
                {formatUSD(b.current_balance)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Party, code, wire reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8 w-full"
            />
          </div>

          <select
            value={selectedBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
            className="select"
          >
            <option value="ALL">All Bank Accounts</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.bank_name} ({b.currency})
              </option>
            ))}
          </select>
        </div>

        <div className="text-slate-500 text-[11px]">
          Showing <b>{filtered.length}</b> transactions
        </div>
      </div>

      {/* Bank Transactions Ledger Table */}
      <div className="table-container shadow-2xs">
        <table className="table">
          <thead>
            <tr>
              <th className="w-24">Date</th>
              <th className="w-28">TX Code</th>
              <th>Bank Account</th>
              <th>Party / Payee</th>
              <th>Transaction Type</th>
              <th className="text-right w-28">Money In ($)</th>
              <th className="text-right w-28">Money Out ($)</th>
              <th className="text-right w-32">Running Balance</th>
              <th className="text-center w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                  Loading bank transactions...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                  No bank transactions found.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                    {t.date}
                  </td>
                  <td className="font-mono font-bold text-sky-600 dark:text-sky-400 text-[11px]">
                    {t.transaction_code}
                  </td>
                  <td>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {t.bank_name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {t.account_number}
                    </div>
                  </td>
                  <td>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {t.party_name}
                    </div>
                    {t.transaction_reference && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        Ref: {t.transaction_reference}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-neutral text-[9px] font-mono">
                      {t.transaction_type}
                    </span>
                  </td>
                  <td className="text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    {t.usd_equivalent_in > 0 ? formatUSD(t.usd_equivalent_in) : "—"}
                  </td>
                  <td className="text-right font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                    {t.usd_equivalent_out > 0 ? formatUSD(t.usd_equivalent_out) : "—"}
                  </td>
                  <td className="text-right font-mono font-bold text-xs">
                    <span
                      className={
                        t.running_balance < 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600"
                      }
                    >
                      {formatUSD(t.running_balance)}
                    </span>
                  </td>
                  <td className="text-center">
                    <span
                      className={`badge text-[9px] ${
                        t.status === "RECONCILED"
                          ? "badge-success"
                          : t.status === "CLEARED"
                          ? "badge-info"
                          : "badge-neutral"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Record Bank Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-sky-600" />
                Record Bank Transaction
              </h3>
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

            <form onSubmit={handleCreateTx} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Bank Vault / Account *</label>
                  <select
                    value={modalBankId}
                    onChange={(e) => setModalBankId(parseInt(e.target.value))}
                    className="select w-full"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} ({b.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Transaction Type *</label>
                  <select
                    value={txType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTxType(val);
                      if (val.includes("RECEIPT")) {
                        setTxDirection("IN");
                        setPartyType("CUSTOMER");
                      } else {
                        setTxDirection("OUT");
                        if (val.includes("SUPPLIER")) setPartyType("SUPPLIER");
                        else if (val.includes("TRANSPORT")) setPartyType("TRANSPORT");
                        else setPartyType("OTHER");
                      }
                    }}
                    className="select w-full"
                  >
                    <option value="CUSTOMER_RECEIPT">CUSTOMER_RECEIPT (Money In)</option>
                    <option value="SUPPLIER_PAYMENT">SUPPLIER_PAYMENT (Money Out)</option>
                    <option value="TRANSPORT_PAYMENT">TRANSPORT_PAYMENT (Money Out)</option>
                    <option value="BANK_CHARGE">BANK_CHARGE (Money Out)</option>
                    <option value="EXPENSE_PAYMENT">EXPENSE_PAYMENT (Money Out)</option>
                    <option value="TRANSFER">TRANSFER (Account to Account)</option>
                    <option value="OTHER">OTHER TRANSACTION</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Party / Payee Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Customer, vendor, or carrier name"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Multi-Currency Cluster */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Multi-Currency & Exchange Rate
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="select w-full py-1 text-xs"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="AFN">AFN (Afghani)</option>
                      <option value="AED">AED (Dirham)</option>
                      <option value="INR">INR (Rupee)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Amount ({currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={originalAmount || ""}
                      onChange={(e) => setOriginalAmount(parseFloat(e.target.value) || 0)}
                      className="input w-full py-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">FX Rate per USD</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={fxRate}
                      disabled={currency === "USD"}
                      onChange={(e) => setFxRate(parseFloat(e.target.value) || 1.0)}
                      className="input w-full py-1 text-xs font-mono disabled:opacity-50"
                    />
                  </div>
                </div>

                {currency !== "USD" && originalAmount > 0 && (
                  <div className="text-[11px] font-mono font-bold text-sky-600">
                    USD Equivalent: ${((originalAmount / (fxRate || 1))).toFixed(2)}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1">Reference / UTR / Check #</label>
                <input
                  type="text"
                  placeholder="MT103, SWIFT reference, check number"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  placeholder="Additional wire notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary font-bold">
                  Post Bank Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
