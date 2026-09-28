"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Truck,
  CreditCard,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  ExternalLink,
  X,
  FileText,
  ArrowLeftRight,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { BankingNav } from "@/components/BankingNav";
import { PdfDownloadButton, PrintButton, MoneyDisplay } from "@/components/accounting";

interface TransportPosition {
  total_freight_charges: number;
  total_payments: number;
  total_opening_credit: number;
  net_balance: number;
  carrier_credit_in_our_favor: number;
  has_carrier_credit: boolean;
  status: string;
}

interface TransportLedgerLine {
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
}

interface BankAccount {
  id: number;
  bank_name: string;
  currency: string;
}

export default function TransportAccountPage() {
  const [position, setPosition] = useState<TransportPosition | null>(null);
  const [ledgerLines, setLedgerLines] = useState<TransportLedgerLine[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<number>(1);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState("USD");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [posRes, banks] = await Promise.all([
        fetchApi<any>("/accounting/transport/account"),
        fetchApi<BankAccount[]>("/accounting/banks"),
      ]);
      setPosition(posRes.position);
      setLedgerLines(posRes.ledger_lines || []);
      setBankAccounts(banks || []);
      if (banks && banks.length > 0) {
        setSelectedBankId(banks[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load transport account position.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDisbursePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBankId || amount <= 0) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetchApi<any>("/accounting/payments/transport-payment", {
        method: "POST",
        body: JSON.stringify({
          transport_company_id: 1, // Sky Ariana Transport
          bank_account_id: selectedBankId,
          date: paymentDate,
          amount,
          currency,
          reference: reference || null,
          payment_method: "Bank Wire Transfer",
          notes: notes || "Sky Ariana Freight Installment",
        }),
      });

      setSuccessMsg(
        `Transport Payment Disbursed! Voucher ${res.journal_entry_number} (${formatUSD(res.amount_usd)}). Updated Carrier Credit in our favor: ${formatUSD(res.carrier_position.carrier_credit_in_our_favor)}.`
      );
      setIsPaymentOpen(false);
      setAmount(0);
      setReference("");
      setNotes("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to disburse transport payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider rounded-md uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              CARRIER STANDING
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Transport Account & Carrier Position
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authoritative freight charges and wire transfers with Sky Ariana Transport.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PdfDownloadButton
            url="/api/v1/transport/statement.pdf"
            filename="AQ-Transport-Statement-Sky-Ariana.pdf"
            label="Download PDF Statement"
            size="sm"
          />
          <PrintButton label="Print" size="sm" />
          <button
            onClick={loadData}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsPaymentOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Disburse Transport Payment</span>
          </button>
        </div>
      </div>

      <BankingNav />

      {/* Mobile Action Bar (Req 30: Pay Transport, Statement, Transactions) */}
      <div className="md:hidden grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setIsPaymentOpen(true)}
          className="p-3 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Pay Transport</span>
        </button>
        <a
          href="/api/v1/transport/statement.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 text-center shadow-2xs"
        >
          <FileText className="w-4 h-4 text-rose-500" />
          <span>Statement</span>
        </a>
        <Link
          href="/banking/transactions"
          className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 text-center shadow-2xs"
        >
          <ArrowLeftRight className="w-4 h-4 text-sky-500" />
          <span>Ledger</span>
        </Link>
      </div>

      {/* Critical Carrier Credit Verified Callout */}
      {position && (
        <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-300 dark:border-emerald-800 shadow-2xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-600/20">
                <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-xs font-black tracking-wider uppercase text-emerald-800 dark:text-emerald-300">
                    Sky Ariana Logistics Account
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 uppercase">
                    AQ Companies in Credit
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                  Carrier Credit in Our Favor: {formatUSD(position.carrier_credit_in_our_favor)}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  AQ Companies has disbursed wire transfers in excess of freight charges. The carrier owes services or cash refund to AQ Companies.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full md:w-auto text-left sm:text-right bg-white/40 dark:bg-slate-900/40 p-3 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-emerald-200/50 dark:border-emerald-800/40">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Freight Incurred</div>
                <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  {formatUSD(position.total_freight_charges)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Wires Paid</div>
                <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {formatUSD(position.total_payments)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Opening Credit</div>
                <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  {formatUSD(position.total_opening_credit)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Transport Ledger Table Container */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Carrier Ledger Activity ({ledgerLines.length} Entries)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chronological freight charges (Debits) and wire disbursements (Credits)
            </p>
          </div>
        </div>

        {/* Mobile Ledger Activity Cards (< md) */}
        <div className="md:hidden p-3 space-y-2.5">
          {ledgerLines.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              No carrier activity recorded.
            </div>
          ) : (
            ledgerLines.map((line, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {line.reference}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">{line.date}</span>
                </div>

                <p className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-2">
                  {line.description}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                  {line.debit > 0 ? (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Freight (Debit)</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatUSD(line.debit)}</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Wire (Credit)</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatUSD(line.credit)}</span>
                    </div>
                  )}

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Running Bal</span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {line.running_balance < 0
                        ? `-${formatUSD(Math.abs(line.running_balance))} (Credit)`
                        : formatUSD(line.running_balance)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Ledger Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[10px] font-semibold uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Reference / Invoice</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Debit (Freight Incurred)</th>
                <th className="py-3 px-4 text-right">Credit (Wire Paid)</th>
                <th className="py-3 px-4 text-right">Running Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {ledgerLines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 font-mono whitespace-nowrap">{line.date}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                    {line.reference}
                  </td>
                  <td className="py-2.5 px-4">{line.description}</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-900 dark:text-white">
                    {line.debit > 0 ? formatUSD(line.debit) : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {line.credit > 0 ? formatUSD(line.credit) : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                    {line.running_balance < 0
                      ? `-${formatUSD(Math.abs(line.running_balance))} (Credit)`
                      : formatUSD(line.running_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disburse Transport Payment Modal */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Disburse Transport Wire Payment
              </h2>
              <button
                onClick={() => setIsPaymentOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisbursePayment} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Transporter / Carrier
                </label>
                <input
                  type="text"
                  disabled
                  value="Sky Ariana Transport Company"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Disburse From Bank Account *
                </label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} ({b.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Currency *
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="AFN">AFN (؋)</option>
                    <option value="AED">AED (Dirham)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Payment Amount ({currency}) *
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount || ""}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 min-h-[44px] text-base font-black rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Wire Transfer Reference / SWIFT
                </label>
                <input
                  type="text"
                  placeholder="e.g. WT-SKY-2026-004"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
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
                  onClick={() => setIsPaymentOpen(false)}
                  className="px-4 py-2.5 min-h-[44px] rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || amount <= 0}
                  className="px-5 py-2.5 min-h-[44px] rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Processing..." : "Disburse Payment (Dr 2100 / Cr 1000)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
