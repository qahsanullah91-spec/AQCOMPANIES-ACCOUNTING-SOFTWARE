"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
  X,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { BankingNav } from "@/components/BankingNav";
import {
  PdfDownloadButton,
  PrintButton,
  MoneyDisplay,
} from "@/components/accounting";

interface SupplierPayable {
  supplier_id: number;
  supplier_name: string;
  total_purchase_billed: number;
  total_paid: number;
  balance_payable: number;
  pending_invoices_count: number;
  purchases: Array<{
    id: number;
    purchase_code: string;
    product_name: string;
    date: string;
    amount: number | null;
    status: string;
  }>;
}

interface BankAccount {
  id: number;
  bank_name: string;
  currency: string;
}

export default function SupplierPayablesPage() {
  const [suppliers, setSuppliers] = useState<SupplierPayable[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Payment Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number>(1);
  const [selectedBankId, setSelectedBankId] = useState<number>(1);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Wire Transfer");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [suppData, banks] = await Promise.all([
        fetchApi<any>("/purchases"),
        fetchApi<BankAccount[]>("/accounting/banks"),
      ]);

      // Group purchases by supplier
      const suppMap: { [id: number]: SupplierPayable } = {};
      if (Array.isArray(suppData)) {
        suppData.forEach((p: any) => {
          const sid = p.supplier_id || 0;
          const sname = p.supplier?.supplier_name || p.supplier_name || "Afghan Producer Desk";
          if (!suppMap[sid]) {
            suppMap[sid] = {
              supplier_id: sid,
              supplier_name: sname,
              total_purchase_billed: 0,
              total_paid: 0,
              balance_payable: 0,
              pending_invoices_count: 0,
              purchases: [],
            };
          }
          const amt = p.purchase_amount ? parseFloat(p.purchase_amount) : null;
          if (amt !== null) {
            suppMap[sid].total_purchase_billed += amt;
            suppMap[sid].balance_payable += amt;
          } else {
            suppMap[sid].pending_invoices_count += 1;
          }
          suppMap[sid].purchases.push({
            id: p.id,
            purchase_code: p.purchase_code,
            product_name: p.product_name,
            date: p.date,
            amount: amt,
            status: p.status,
          });
        });
      }

      setSuppliers(Object.values(suppMap));
      setBankAccounts(banks || []);
      if (banks && banks.length > 0) {
        setSelectedBankId(banks[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load supplier payables.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDisbursePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !selectedBankId || amount <= 0) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetchApi<any>("/accounting/payments/supplier-payment", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: selectedSupplierId,
          bank_account_id: selectedBankId,
          date: paymentDate,
          amount,
          currency,
          exchange_rate: exchangeRate,
          reference: reference || null,
          payment_method: paymentMethod,
          notes: notes || null,
        }),
      });

      setSuccessMsg(
        `Disbursement posted! Voucher ${res.journal_entry_number} (${formatUSD(res.total_disbursed_usd)}). Advance booked to Account 1350: ${formatUSD(res.supplier_advance_usd)}.`
      );
      setIsPaymentOpen(false);
      setAmount(0);
      setReference("");
      setNotes("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to disburse supplier payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.supplier_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider rounded-md uppercase bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
              TRADE PAYABLES
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Supplier Payables & Procurement
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supplier procurement payables, Afghan supplier advances (Account 1350), and wire disbursements.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <PrintButton label="Print Payables" size="sm" />
          <button
            onClick={loadData}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setIsPaymentOpen(true);
              if (suppliers.length > 0) setSelectedSupplierId(suppliers[0].supplier_id);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Disburse Supplier Payment</span>
          </button>
        </div>
      </div>

      <BankingNav />

      {/* Afghan Cost Protection Callout */}
      <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 flex items-start space-x-3 text-xs">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-900 dark:text-amber-200">
            Strict Real Business Grounding: Pending Afghan Supplier Invoices
          </h3>
          <p className="text-amber-800 dark:text-amber-300 mt-0.5">
            Purchase orders from Afghan dry fruit producers remain marked as{" "}
            <strong>PENDING_SUPPLIER_INVOICE</strong> until official final billing is received. The system will
            NEVER fabricate or guess unbilled purchase costs. Advances paid to suppliers are booked to{" "}
            <strong>Account 1350 Supplier Advances</strong>.
          </p>
        </div>
      </div>

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

      {/* Supplier List */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Supplier Accounts ({suppliers.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Procurement orders and unpriced invoice tracking
            </p>
          </div>

          <div className="w-64 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Mobile Supplier Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-3">
          {filteredSuppliers.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No suppliers found matching your search.
            </div>
          ) : (
            filteredSuppliers.map((s) => {
              const isDue = s.balance_payable > 0;
              const hasPending = s.pending_invoices_count > 0;

              return (
                <div
                  key={s.supplier_id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3 text-xs"
                >
                  {/* Card Header: Supplier Name & Status Badge */}
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {s.supplier_name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {s.purchases.length} total procurement order{s.purchases.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center space-x-1.5">
                      {isDue ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                          PAYABLE DUE
                        </span>
                      ) : hasPending ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          PENDING BILLING
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          SETTLED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial Grid */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Billed</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        {formatUSD(s.total_purchase_billed)}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40">
                      <span className="text-[10px] text-rose-600 block uppercase font-bold">Balance Payable</span>
                      <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                        {formatUSD(s.balance_payable)}
                      </span>
                    </div>
                  </div>

                  {/* Status Notes */}
                  {hasPending && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                      <span>Afghan Producer Billing</span>
                      <span className="font-bold">{s.pending_invoices_count} POs Pending Official Rates</span>
                    </div>
                  )}

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <PdfDownloadButton
                      url={`/api/v1/suppliers/${s.supplier_id}/statement.pdf`}
                      filename={`AQ-Supplier-Statement-${s.supplier_name}.pdf`}
                      label="Statement PDF"
                      size="sm"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSupplierId(s.supplier_id);
                        setIsPaymentOpen(true);
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors min-h-[36px] flex items-center justify-center"
                    >
                      Disburse Payment
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[10px] font-semibold uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Supplier Name</th>
                <th className="py-3 px-4 text-center">Billed Purchase Orders</th>
                <th className="py-3 px-4 text-center">Pending Supplier Billing</th>
                <th className="py-3 px-4 text-right">Total Billed</th>
                <th className="py-3 px-4 text-right">Balance Payable</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {filteredSuppliers.map((s) => (
                <tr key={s.supplier_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {s.supplier_name}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {s.purchases.length - s.pending_invoices_count} orders
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {s.pending_invoices_count > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        {s.pending_invoices_count} Pending Invoices
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">All Billed</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatUSD(s.total_purchase_billed)}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                    {formatUSD(s.balance_payable)}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <PdfDownloadButton
                      url={`/api/v1/suppliers/${s.supplier_id}/statement.pdf`}
                      filename={`AQ-Supplier-Statement-${s.supplier_name}.pdf`}
                      label="Statement PDF"
                      size="sm"
                    />
                    <button
                      onClick={() => {
                        setSelectedSupplierId(s.supplier_id);
                        setIsPaymentOpen(true);
                      }}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors"
                    >
                      Disburse Payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disburse Payment Modal */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Disburse Supplier Payment
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
                  Supplier *
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                >
                  {suppliers.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.supplier_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Disburse From Bank / Vault *
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
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Exchange Rate
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1.0)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Disbursement Amount ({currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount || ""}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-base font-black rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Wire / Sarafi Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. SAR-KBL-89214 / WT-99201"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Sarafi / Hawala">Sarafi / Hawala</option>
                  <option value="Bank Wire Transfer">Bank Wire Transfer</option>
                  <option value="Cash Vault Disbursement">Cash Vault Disbursement</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Notes / Procurement Memo
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
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || amount <= 0}
                  className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Disburse Wire (GL Voucher SP)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
