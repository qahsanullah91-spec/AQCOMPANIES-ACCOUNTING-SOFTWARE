"use client";

import React, { useEffect, useState } from "react";
import {
  Landmark,
  Plus,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  DollarSign,
  Download,
  CreditCard,
  Building,
  CheckCircle,
  HelpCircle,
  FileText,
} from "lucide-react";
import { fetchApi, formatUSD, formatRate, formatNumber } from "@/lib/api";

interface BankAccount {
  id: number;
  bank_name: string;
  account_name: string;
  account_number: string;
  swift_iban?: string;
  currency: string;
  opening_balance: number;
  current_balance: number;
  notes?: string;
}

interface BankTransaction {
  id: number;
  transaction_code: string;
  date: string;
  bank_account_id: number;
  bank_name: string;
  account_number: string;
  party_type: string;
  party_id?: number;
  party_name: string;
  transaction_type: string;
  invoice_id?: number;
  invoice_number?: string;
  shipment_id?: number;
  purchase_id?: number;
  currency: string;
  money_in: number;
  money_out: number;
  exchange_rate: number;
  usd_equivalent_in: number;
  usd_equivalent_out: number;
  transaction_reference?: string;
  running_balance: number;
  payment_method?: string;
  notes?: string;
  attachment_path?: string;
}

export default function BankLedgerPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isAccModalOpen, setIsAccModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [txForm, setTxForm] = useState({
    bank_account_id: "",
    date: new Date().toISOString().split("T")[0],
    transaction_type: "CUSTOMER RECEIPT",
    party_type: "CUSTOMER",
    party_name: "Royal Dry Fruits Mumbai Pvt Ltd",
    currency: "USD",
    amount: 50000,
    exchange_rate: 1.0,
    transaction_reference: "SWIFT TT-9988123",
    payment_method: "Bank Transfer",
    notes: "Wire transfer advance against shipment",
  });

  const [accForm, setAccForm] = useState({
    bank_name: "",
    account_name: "AQ COMPANIES",
    account_number: "",
    swift_iban: "",
    currency: "USD",
    opening_balance: 0,
    notes: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [accData, txData] = await Promise.all([
        fetchApi<BankAccount[]>("/bank-accounts"),
        fetchApi<BankTransaction[]>("/bank-transactions"),
      ]);
      setAccounts(accData || []);
      setTransactions(txData || []);
      if (accData && accData.length > 0 && !txForm.bank_account_id) {
        setTxForm((prev) => ({ ...prev, bank_account_id: String(accData[0].id) }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.bank_account_id) {
      setErrorMsg("Please select a bank account");
      return;
    }
    const isMoneyIn =
      txForm.transaction_type === "CUSTOMER RECEIPT" || txForm.transaction_type === "OTHER INCOME";

    try {
      setSubmitting(true);
      setErrorMsg("");
      await fetchApi("/bank-transactions", {
        method: "POST",
        body: JSON.stringify({
          bank_account_id: Number(txForm.bank_account_id),
          date: txForm.date,
          party_type: txForm.party_type,
          party_name: txForm.party_name,
          transaction_type: txForm.transaction_type,
          currency: txForm.currency,
          money_in: isMoneyIn ? Number(txForm.amount) : 0,
          money_out: !isMoneyIn ? Number(txForm.amount) : 0,
          exchange_rate: Number(txForm.exchange_rate),
          transaction_reference: txForm.transaction_reference,
          payment_method: txForm.payment_method,
          notes: txForm.notes,
        }),
      });
      setIsTxModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAcc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg("");
      await fetchApi("/bank-accounts", {
        method: "POST",
        body: JSON.stringify({
          ...accForm,
          opening_balance: Number(accForm.opening_balance),
        }),
      });
      setIsAccModalOpen(false);
      setAccForm({
        bank_name: "",
        account_name: "AQ COMPANIES",
        account_number: "",
        swift_iban: "",
        currency: "USD",
        opening_balance: 0,
        notes: "",
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTx = transactions.filter((tx) => {
    const matchesSearch =
      (tx.transaction_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (tx.party_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (tx.transaction_reference || "").toLowerCase().includes(search.toLowerCase()) ||
      (tx.bank_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesAccount = selectedAccountId ? String(tx.bank_account_id) === selectedAccountId : true;
    const matchesType = typeFilter ? tx.transaction_type === typeFilter : true;
    return matchesSearch && matchesAccount && matchesType;
  });

  const totalBankBalanceUSD = accounts.reduce((acc, a) => {
    if (a.currency === "USD") return acc + Number(a.current_balance);
    if (a.currency === "INR") return acc + Number(a.current_balance) / 84.0;
    if (a.currency === "AFN") return acc + Number(a.current_balance) / 72.0;
    if (a.currency === "AED") return acc + Number(a.current_balance) / 3.67;
    return acc + Number(a.current_balance);
  }, 0);

  const totalInflowsUSD = transactions.reduce((acc, t) => acc + Number(t.usd_equivalent_in || 0), 0);
  const totalOutflowsUSD = transactions.reduce((acc, t) => acc + Number(t.usd_equivalent_out || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Landmark className="w-7 h-7 text-emerald-600" />
            Bank & Cash Ledger
          </h1>
          <p className="text-sm text-slate-500">
            Multi-Currency Accounts (USD / AFN / AED / INR) • Verified Wire Receipts & Wire Disbursements
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAccModalOpen(true)}
            className="btn btn-secondary flex items-center gap-2 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
          <button
            onClick={() => setIsTxModalOpen(true)}
            className="btn btn-primary flex items-center gap-2 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            Record Transaction
          </button>
        </div>
      </div>

      {/* Bank Account Balances Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            onClick={() => setSelectedAccountId(selectedAccountId === String(acc.id) ? "" : String(acc.id))}
            className={`card p-5 cursor-pointer transition-all border ${
              selectedAccountId === String(acc.id)
                ? "border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500"
                : "bg-white hover:border-slate-300 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {acc.bank_name}
              </span>
              <span className="badge badge-neutral text-xs font-mono font-bold">{acc.currency}</span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {acc.currency === "USD"
                ? formatUSD(acc.current_balance)
                : `${acc.currency} ${Number(acc.current_balance).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </p>
            <div className="mt-2 pt-2 border-t text-[11px] text-slate-400 font-mono truncate">
              A/C: {acc.account_number}
            </div>
          </div>
        ))}

        {accounts.length === 0 && (
          <div className="col-span-4 card p-8 text-center text-slate-400">
            No bank accounts created yet.
          </div>
        )}
      </div>

      {/* Liquidity Overview Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-white border-l-4 border-l-emerald-600 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Estimated Total Liquidity</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatUSD(totalBankBalanceUSD)}</p>
          <span className="text-[11px] text-slate-400">USD Consolidated Equivalent</span>
        </div>
        <div className="card p-4 bg-white border-l-4 border-l-indigo-600 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Inflows (Receipts)</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatUSD(totalInflowsUSD)}</p>
          <span className="text-[11px] text-slate-400">Customer TT / Bank Wires</span>
        </div>
        <div className="card p-4 bg-white border-l-4 border-l-rose-600 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Outflows (Payments)</span>
          <p className="text-xl font-bold text-rose-600 mt-1">{formatUSD(totalOutflowsUSD)}</p>
          <span className="text-[11px] text-slate-400">Supplier & Transport Disbursements</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card p-4 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search reference, party, bank..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-sm w-full"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="select text-sm w-full md:w-48"
          >
            <option value="">All Bank Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bank_name} ({a.currency})
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="select text-sm w-full md:w-48"
          >
            <option value="">All Types</option>
            <option value="CUSTOMER RECEIPT">Customer Receipt</option>
            <option value="SUPPLIER PAYMENT">Supplier Payment</option>
            <option value="TRANSPORT PAYMENT">Transport Payment</option>
            <option value="BANK CHARGE">Bank Charge</option>
            <option value="OTHER EXPENSE">Other Expense</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden bg-white shadow-sm">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Code / Date</th>
                <th>Bank & Account</th>
                <th>Party & Description</th>
                <th>Type</th>
                <th className="text-right">Money In</th>
                <th className="text-right">Money Out</th>
                <th className="text-right">USD Equivalent</th>
                <th className="text-right">Running Balance</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    Loading bank transactions...
                  </td>
                </tr>
              ) : filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    No bank transactions recorded matching filters.
                  </td>
                </tr>
              ) : (
                filteredTx.map((tx) => {
                  const isMoneyIn = Number(tx.money_in) > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="font-semibold text-slate-900">
                        <div>{tx.transaction_code}</div>
                        <div className="text-xs text-slate-400 font-normal">{tx.date}</div>
                      </td>
                      <td>
                        <div className="font-bold text-slate-800 text-xs">{tx.bank_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{tx.account_number}</div>
                      </td>
                      <td>
                        <div className="font-medium text-slate-900">{tx.party_name}</div>
                        {tx.notes && <div className="text-xs text-slate-500 italic">{tx.notes}</div>}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            tx.transaction_type === "CUSTOMER RECEIPT"
                              ? "badge-success"
                              : tx.transaction_type === "SUPPLIER PAYMENT"
                              ? "badge-warning"
                              : tx.transaction_type === "TRANSPORT PAYMENT"
                              ? "badge-primary"
                              : "badge-neutral"
                          } text-[11px]`}
                        >
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="text-right font-bold text-emerald-600">
                        {isMoneyIn ? (
                          <span className="flex items-center justify-end gap-1">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            {tx.currency} {Number(tx.money_in).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="text-right font-bold text-rose-600">
                        {!isMoneyIn ? (
                          <span className="flex items-center justify-end gap-1">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            {tx.currency} {Number(tx.money_out).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="text-right font-mono font-medium text-slate-900">
                        {isMoneyIn ? (
                          <span className="text-emerald-700">+{formatUSD(tx.usd_equivalent_in)}</span>
                        ) : (
                          <span className="text-rose-700">-{formatUSD(tx.usd_equivalent_out)}</span>
                        )}
                      </td>
                      <td className="text-right font-extrabold text-slate-900">
                        {formatUSD(tx.running_balance)}
                      </td>
                      <td className="text-xs text-slate-600 font-mono">
                        <div>{tx.transaction_reference || "Direct"}</div>
                        <div className="text-[10px] text-slate-400 font-sans">{tx.payment_method}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Transaction Modal */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record Bank Transaction</h3>
                <p className="text-xs text-slate-500">
                  Enter verified bank receipt or official wire disbursement
                </p>
              </div>
              <button
                onClick={() => setIsTxModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateTx} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Bank Account *</label>
                  <select
                    className="select text-sm w-full font-bold"
                    value={txForm.bank_account_id}
                    onChange={(e) => setTxForm({ ...txForm, bank_account_id: e.target.value })}
                    required
                  >
                    <option value="">Select Account...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bank_name} ({a.currency} - {a.account_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Transaction Date *</label>
                  <input
                    type="date"
                    className="input text-sm w-full"
                    value={txForm.date}
                    onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Transaction Type *</label>
                  <select
                    className="select text-sm w-full font-semibold"
                    value={txForm.transaction_type}
                    onChange={(e) => {
                      const val = e.target.value;
                      let pType = "OTHER";
                      if (val === "CUSTOMER RECEIPT") pType = "CUSTOMER";
                      else if (val === "SUPPLIER PAYMENT") pType = "SUPPLIER";
                      else if (val === "TRANSPORT PAYMENT") pType = "TRANSPORT";
                      setTxForm({ ...txForm, transaction_type: val, party_type: pType });
                    }}
                    required
                  >
                    <option value="CUSTOMER RECEIPT">Customer Receipt (Money In)</option>
                    <option value="SUPPLIER PAYMENT">Supplier Payment (Money Out)</option>
                    <option value="TRANSPORT PAYMENT">Transport Payment (Money Out)</option>
                    <option value="BANK CHARGE">Bank Service Charge (Money Out)</option>
                    <option value="OTHER EXPENSE">Other Operating Expense (Money Out)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Party / Counterparty Name *</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="Customer / Supplier / Carrier name"
                    value={txForm.party_name}
                    onChange={(e) => setTxForm({ ...txForm, party_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Transaction Currency</label>
                  <select
                    className="select text-sm w-full"
                    value={txForm.currency}
                    onChange={(e) => setTxForm({ ...txForm, currency: e.target.value })}
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="AFN">AFN - Afghan Afghani</option>
                    <option value="AED">AED - UAE Dirham</option>
                  </select>
                </div>

                <div>
                  <label className="label">Exchange Rate to USD</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="input text-sm w-full"
                    value={txForm.exchange_rate}
                    onChange={(e) => setTxForm({ ...txForm, exchange_rate: Number(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Amount ({txForm.currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input text-sm w-full font-bold"
                    value={txForm.amount}
                    onChange={(e) => setTxForm({ ...txForm, amount: Number(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label className="label">USD Equivalent</label>
                  <div className="input bg-slate-50 font-extrabold text-slate-900 flex items-center">
                    {txForm.currency === "INR" || txForm.currency === "AFN"
                      ? formatUSD(txForm.amount / (txForm.exchange_rate || 1))
                      : formatUSD(txForm.amount * (txForm.exchange_rate || 1))}
                  </div>
                </div>

                <div>
                  <label className="label">Transaction / SWIFT Reference *</label>
                  <input
                    type="text"
                    placeholder="e.g. TT-9988123 or UTR #12345"
                    className="input text-sm w-full font-mono"
                    value={txForm.transaction_reference}
                    onChange={(e) => setTxForm({ ...txForm, transaction_reference: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Payment Method</label>
                  <select
                    className="select text-sm w-full"
                    value={txForm.payment_method}
                    onChange={(e) => setTxForm({ ...txForm, payment_method: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Wire / SWIFT TT</option>
                    <option value="RTGS / NEFT">RTGS / NEFT (India)</option>
                    <option value="Sarafi Transfer">Sarafi / Hawala Transfer</option>
                    <option value="Cash Deposit">Direct Cash Deposit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Notes / Narration</label>
                <textarea
                  rows={2}
                  className="textarea text-sm w-full"
                  placeholder="e.g. 50% advance for container MRKU1234567, invoice INV-AQ-2026-001"
                  value={txForm.notes}
                  onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-sm flex items-center gap-2"
                >
                  {submitting ? "Recording..." : "Record Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Bank Account Modal */}
      {isAccModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add Bank Account</h3>
                <p className="text-xs text-slate-500">Register company bank account</p>
              </div>
              <button
                onClick={() => setIsAccModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAcc} className="space-y-4">
              <div>
                <label className="label">Bank Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Emirates NBD Dubai"
                  className="input text-sm w-full"
                  value={accForm.bank_name}
                  onChange={(e) => setAccForm({ ...accForm, bank_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Account Holder Name *</label>
                <input
                  type="text"
                  className="input text-sm w-full"
                  value={accForm.account_name}
                  onChange={(e) => setAccForm({ ...accForm, account_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Account Number / IBAN *</label>
                <input
                  type="text"
                  placeholder="AE440260000123456789012"
                  className="input text-sm w-full font-mono"
                  value={accForm.account_number}
                  onChange={(e) => setAccForm({ ...accForm, account_number: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Currency *</label>
                  <select
                    className="select text-sm w-full font-bold"
                    value={accForm.currency}
                    onChange={(e) => setAccForm({ ...accForm, currency: e.target.value })}
                  >
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                    <option value="AFN">AFN</option>
                    <option value="AED">AED</option>
                  </select>
                </div>

                <div>
                  <label className="label">Opening Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input text-sm w-full font-bold"
                    value={accForm.opening_balance}
                    onChange={(e) => setAccForm({ ...accForm, opening_balance: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="label">SWIFT / IFSC Code</label>
                <input
                  type="text"
                  placeholder="EBILAEADXXX"
                  className="input text-sm w-full font-mono"
                  value={accForm.swift_iban}
                  onChange={(e) => setAccForm({ ...accForm, swift_iban: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAccModalOpen(false)}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-sm"
                >
                  {submitting ? "Saving..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
