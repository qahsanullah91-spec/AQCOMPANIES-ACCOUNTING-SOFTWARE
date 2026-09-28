"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  Search,
  Filter,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Landmark,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  X,
  Download,
  FileText,
  Scale,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { BankingNav } from "@/components/BankingNav";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";
import {
  PdfDownloadButton,
  PrintButton,
  MoneyDisplay,
} from "@/components/accounting";

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  currency: string;
}

interface BankTransaction {
  id: number;
  transaction_code: string;
  date: string;
  bank_account_id: number;
  bank_name: string;
  account_number: string;
  party_type: string;
  party_id: number | null;
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
  bank_reference: string | null;
  swift_reference: string | null;
  sarafi_reference: string | null;
  cheque_number: string | null;
  payment_method: string | null;
  status: string;
  approval_status: string;
  is_reversed: boolean;
  reversal_of_id: number | null;
  reversed_by_id: number | null;
  reversal_reason: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

function BankTransactionsLedgerContent() {
  const searchParams = useSearchParams();
  const initialBankId = searchParams.get("bank_account_id") || "ALL";

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>(initialBankId);
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reversal Modal & Mobile Detail Sheet
  const [reversingTx, setReversingTx] = useState<BankTransaction | null>(null);
  const [detailTx, setDetailTx] = useState<BankTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [submittingReversal, setSubmittingReversal] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = "/accounting/bank-transactions?";
      if (selectedBankId !== "ALL") query += `bank_account_id=${selectedBankId}&`;
      if (selectedType !== "ALL") query += `transaction_type=${selectedType}&`;
      if (selectedStatus !== "ALL") query += `status=${selectedStatus}&`;
      if (search.trim()) query += `search=${encodeURIComponent(search.trim())}&`;

      const [txs, accs] = await Promise.all([
        fetchApi<BankTransaction[]>(query),
        fetchApi<BankAccount[]>("/accounting/banks"),
      ]);
      setTransactions(txs || []);
      setBankAccounts(accs || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load bank ledger transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBankId, selectedType, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingTx || !reversalReason.trim()) return;

    try {
      setSubmittingReversal(true);
      setError(null);
      await fetchApi(`/accounting/bank-transactions/${reversingTx.id}/reverse`, {
        method: "POST",
        body: JSON.stringify({
          reason: reversalReason.trim(),
          user_name: "AuditTester",
        }),
      });
      setReversingTx(null);
      setReversalReason("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to reverse transaction.");
    } finally {
      setSubmittingReversal(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider rounded-md uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              AUTHORITATIVE LEDGER
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Universal Bank Transactions Ledger
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time chronological bank transactions with authoritative running balances and soft-reversals.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {selectedBankId !== "ALL" && (
            <PdfDownloadButton
              url={`/api/v1/banking/accounts/${selectedBankId}/statement.pdf`}
              filename={`AQ-Bank-Statement-${selectedBankId}.pdf`}
              label="Bank Statement PDF"
              size="sm"
            />
          )}
          <PrintButton label="Print" size="sm" />
          <button
            onClick={loadData}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/banking/reconciliation"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <span>Reconcile Accounts</span>
          </Link>
        </div>
      </div>

      <BankingNav />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, swift, partner, transaction code, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="ALL">All Accounts & Vaults</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name} ({b.currency})
                </option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="ALL">All Transaction Types</option>
              <option value="CUSTOMER_RECEIPT">Customer Receipt</option>
              <option value="CUSTOMER_ADVANCE">Customer Advance</option>
              <option value="SUPPLIER_PAYMENT">Supplier Payment</option>
              <option value="SUPPLIER_ADVANCE">Supplier Advance</option>
              <option value="TRANSPORT_PAYMENT">Transport Payment</option>
              <option value="BANK_CHARGE">Bank Charge</option>
              <option value="EXPENSE_PAYMENT">Expense Payment</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="CLEARED">CLEARED</option>
              <option value="RECONCILED">RECONCILED</option>
              <option value="REVERSED">REVERSED</option>
              <option value="VOID">VOID</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Ledger Entries ({transactions.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sorted chronologically with live running balance tracking
            </p>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Transaction Code</th>
                <th className="py-3 px-3">Bank Account</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Party Name</th>
                <th className="py-3 px-3">Reference / SWIFT</th>
                <th className="py-3 px-3 text-right">Money In</th>
                <th className="py-3 px-3 text-right">Money Out</th>
                <th className="py-3 px-3 text-right">USD In</th>
                <th className="py-3 px-3 text-right">USD Out</th>
                <th className="py-3 px-3 text-right">Running Balance (USD)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-400">
                    No transactions found matching your criteria.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors ${
                      tx.is_reversed ? "opacity-60 bg-rose-50/20 dark:bg-rose-950/10 line-through" : ""
                    }`}
                  >
                    <td className="py-3 px-3 font-medium whitespace-nowrap">{tx.date}</td>
                    <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {tx.transaction_code}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{tx.bank_name}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">{tx.account_number}</span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          tx.transaction_type.includes("RECEIPT") || tx.transaction_type.includes("ADVANCE_CUSTOMER")
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : tx.transaction_type.includes("TRANSPORT")
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : tx.transaction_type.includes("CHARGE")
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                            : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                        }`}
                      >
                        {tx.transaction_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium max-w-[140px] truncate" title={tx.party_name}>
                      {tx.party_name}
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px] max-w-[130px] truncate" title={tx.transaction_reference || ""}>
                      {tx.transaction_reference || tx.swift_reference || "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {tx.money_in > 0 ? `${tx.currency} ${tx.money_in.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      {tx.money_out > 0 ? `${tx.currency} ${tx.money_out.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {tx.usd_equivalent_in > 0 ? formatUSD(tx.usd_equivalent_in) : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      {tx.usd_equivalent_out > 0 ? formatUSD(tx.usd_equivalent_out) : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                      {formatUSD(tx.running_balance)}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === "RECONCILED"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                            : tx.status === "REVERSED"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                      <a
                        href={`/api/v1/vouchers/${tx.transaction_type}/${tx.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download Official Voucher PDF"
                        className="px-2 py-1 text-[10px] font-semibold rounded bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 transition-colors inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Voucher</span>
                      </a>
                      {!tx.is_reversed && tx.status !== "VOID" && !tx.transaction_code.startsWith("REV-") ? (
                        <button
                          onClick={() => {
                            setReversingTx(tx);
                            setReversalReason("");
                          }}
                          title="Soft-reverse transaction and GL journal"
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 transition-colors inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reverse</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Reversed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Transactions Card View (iPhone / Small Viewports) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-2.5">
          {transactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              No transactions found matching your criteria.
            </div>
          ) : (
            transactions.map((tx) => {
              const isMoneyIn = tx.money_in > 0 || tx.usd_equivalent_in > 0;
              const displayAmt = isMoneyIn
                ? tx.usd_equivalent_in || tx.money_in
                : tx.usd_equivalent_out || tx.money_out;

              return (
                <div
                  key={tx.id}
                  onClick={() => setDetailTx(tx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer active:scale-[0.98] ${
                    tx.is_reversed
                      ? "bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900 opacity-60 line-through"
                      : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-sky-500/50"
                  }`}
                >
                  {/* Top Row: Date, Badge, Status */}
                  <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="font-mono font-medium text-slate-500">{tx.date}</span>
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                          isMoneyIn
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        }`}
                      >
                        {isMoneyIn ? "IN / CREDIT" : "OUT / PAYMENT"}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          tx.status === "RECONCILED"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                            : tx.status === "REVERSED"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                  </div>

                  {/* Main Row: Party Name & Amount */}
                  <div className="flex items-start justify-between gap-2 pt-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {tx.party_name || "General Ledger"}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                        {tx.bank_name} • {tx.account_number}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                        Ref: {tx.transaction_reference || tx.swift_reference || tx.transaction_code}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono font-black text-sm ${
                          isMoneyIn
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isMoneyIn ? `+${formatUSD(displayAmt)}` : `-${formatUSD(displayAmt)}`}
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-slate-400 mt-0.5">
                        Bal: {formatUSD(tx.running_balance)}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-end space-x-2 pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <a
                      href={`/api/v1/vouchers/${tx.transaction_type}/${tx.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                    >
                      Voucher PDF
                    </a>
                    {!tx.is_reversed && tx.status !== "VOID" && !tx.transaction_code.startsWith("REV-") && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReversingTx(tx);
                          setReversalReason("");
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                      >
                        Reverse
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile Transaction Detail Bottom Sheet */}
      <MobileBottomSheet
        isOpen={detailTx !== null}
        onClose={() => setDetailTx(null)}
        title={detailTx ? detailTx.transaction_code : "Transaction Detail"}
        subtitle={detailTx ? `${detailTx.date} • ${detailTx.transaction_type.replace(/_/g, " ")}` : ""}
        maxHeight="max-h-[90dvh]"
      >
        {detailTx && (
          <div className="space-y-4 pb-6 text-xs">
            {/* Amount Banner */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-center space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Authoritative Ledger Amount
              </span>
              <div
                className={`text-2xl font-black font-mono ${
                  detailTx.money_in > 0 || detailTx.usd_equivalent_in > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {detailTx.money_in > 0 || detailTx.usd_equivalent_in > 0 ? "+" : "-"}
                {formatUSD(detailTx.usd_equivalent_in || detailTx.usd_equivalent_out || detailTx.money_in || detailTx.money_out)}
              </div>
              <div className="flex items-center justify-center space-x-2 pt-1">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    detailTx.money_in > 0 || detailTx.usd_equivalent_in > 0
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                  }`}
                >
                  {detailTx.money_in > 0 || detailTx.usd_equivalent_in > 0 ? "IN / CREDIT" : "OUT / PAYMENT"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    detailTx.status === "RECONCILED"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                      : detailTx.status === "REVERSED"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  }`}
                >
                  {detailTx.status}
                </span>
              </div>
            </div>

            {/* Core Details List */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Party / Counterparty</span>
                <span className="font-bold text-slate-900 dark:text-white text-right">
                  {detailTx.party_name || "General Ledger"}
                </span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Bank Account</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                  {detailTx.bank_name} ({detailTx.account_number})
                </span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Original Currency</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {detailTx.currency} {Number(detailTx.money_in || detailTx.money_out).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Running Balance</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  {formatUSD(detailTx.running_balance)}
                </span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Transaction Reference</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 text-right">
                  {detailTx.transaction_reference || "—"}
                </span>
              </div>
              {(detailTx.swift_reference || detailTx.sarafi_reference) && (
                <div className="p-3 flex justify-between items-center">
                  <span className="text-slate-500">SWIFT / Sarafi Ref</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 text-right">
                    {detailTx.swift_reference || detailTx.sarafi_reference}
                  </span>
                </div>
              )}
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Matched Invoice / Receipt</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                  {detailTx.transaction_reference || "— (Unallocated)"}
                </span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Payment Method</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {detailTx.payment_method || "Bank Wire / Transfer"}
                </span>
              </div>
              {detailTx.notes && (
                <div className="p-3">
                  <span className="text-slate-500 block mb-0.5">Notes & Memos</span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                    {detailTx.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Audit & Compliance Footnote */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div>Created By: <strong className="text-slate-700 dark:text-slate-200">{detailTx.created_by || "System Auditor"}</strong></div>
              <div>Timestamp: <span className="font-mono">{detailTx.created_at || detailTx.date}</span></div>
            </div>

            {/* Actions Toolbar */}
            <div className="space-y-2 pt-2">
              <Link
                href={`/banking/reconciliation?account_id=${detailTx.bank_account_id}`}
                onClick={() => setDetailTx(null)}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-bold text-xs active:scale-95 transition-all min-h-[44px]"
              >
                <Scale className="w-4 h-4" />
                <span>{detailTx.status === "RECONCILED" ? "Re-Match / Unmatch Transaction" : "Match Transaction to Invoice"}</span>
              </Link>

              <a
                href={`/api/v1/vouchers/${detailTx.transaction_type}/${detailTx.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/25 active:scale-95 transition-all min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                <span>Download Official Voucher PDF</span>
              </a>

              <Link
                href={`/accounting/general-ledger?search=${encodeURIComponent(detailTx.transaction_code)}`}
                onClick={() => setDetailTx(null)}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition-all min-h-[44px]"
              >
                <FileText className="w-4 h-4 text-sky-600" />
                <span>View in General Ledger</span>
              </Link>

              {!detailTx.is_reversed && detailTx.status !== "VOID" && !detailTx.transaction_code.startsWith("REV-") && (
                <button
                  type="button"
                  onClick={() => {
                    const tx = detailTx;
                    setDetailTx(null);
                    setReversingTx(tx);
                    setReversalReason("");
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold text-xs active:scale-95 transition-all min-h-[44px]"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Soft-Reverse This Transaction</span>
                </button>
              )}
            </div>
          </div>
        )}
      </MobileBottomSheet>

      {/* Reversal Confirmation Modal */}
      {reversingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-5 h-5" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Soft-Reverse Transaction
                </h2>
              </div>
              <button
                onClick={() => setReversingTx(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReverse} className="space-y-4 mt-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <div>Code: <strong>{reversingTx.transaction_code}</strong></div>
                <div>Date: {reversingTx.date}</div>
                <div>Party: {reversingTx.party_name}</div>
                <div>Amount: {formatUSD(reversingTx.usd_equivalent_in || reversingTx.usd_equivalent_out)}</div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Reason for Reversal *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why this entry is being reversed (e.g. incorrect amount, wire bounce, duplicate entry)..."
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReversingTx(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReversal || !reversalReason.trim()}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
                >
                  {submittingReversal ? "Reversing..." : "Confirm Soft Reversal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BankTransactionsLedgerPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading bank ledger...</div>}>
      <BankTransactionsLedgerContent />
    </React.Suspense>
  );
}
