"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Plus,
  Building2,
  Landmark,
  ShieldCheck,
  X,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface Customer {
  id: number;
  customer_name: string;
}

interface BankTransaction {
  id: number;
  transaction_code: string;
  date: string;
  bank_name: string;
  party_name: string;
  money_in: number;
  usd_equivalent_in: number;
  transaction_reference: string | null;
}

interface Invoice {
  id: number;
  invoice_number: string;
  date: string;
  total_amount: number;
  amount_received: number;
  balance_due: number;
  payment_status: string;
}

export default function PaymentAllocationPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [bankTxs, setBankTxs] = useState<BankTransaction[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string>("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  // Allocations mapping: { invoiceId: amount }
  const [allocations, setAllocations] = useState<{ [id: number]: number }>({});
  const [successResult, setSuccessResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Quick Wire Entry modal if no existing wire is selected
  const [isQuickWireOpen, setIsQuickWireOpen] = useState(false);
  const [wireAmount, setWireAmount] = useState<number>(0);
  const [wireRef, setWireRef] = useState<string>("");
  const [wireDate, setWireDate] = useState<string>(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    async function init() {
      try {
        const [cList, txList] = await Promise.all([
          fetchApi<Customer[]>("/customers"),
          fetchApi<BankTransaction[]>("/accounting/bank-transactions?transaction_type=CUSTOMER_RECEIPT"),
        ]);
        setCustomers(cList || []);
        setBankTxs(txList || []);
      } catch (err) {
        console.error(err);
      }
    }
    init();
  }, []);

  // When customer changes, load their unpaid invoices
  useEffect(() => {
    if (!selectedCustomerId) {
      setInvoices([]);
      setAllocations({});
      return;
    }

    async function loadCustInvoices() {
      try {
        setLoading(true);
        const data = await fetchApi<Invoice[]>(
          `/accounting/receivables?customer_id=${selectedCustomerId}&status=UNPAID`
        );
        const partialData = await fetchApi<Invoice[]>(
          `/accounting/receivables?customer_id=${selectedCustomerId}&status=PARTIALLY PAID`
        );
        const combined = [...(data || []), ...(partialData || [])];
        setInvoices(combined);
        setAllocations({});
        setSuccessResult(null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadCustInvoices();
  }, [selectedCustomerId]);

  const selectedTx = bankTxs.find((t) => String(t.id) === selectedTxId);
  const availableAmount = selectedTx ? Number(selectedTx.usd_equivalent_in || selectedTx.money_in) : 0;

  const totalAllocated = Object.values(allocations).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );
  const remainingUnallocated = availableAmount - totalAllocated;

  const handleAmountChange = (invoiceId: number, val: number, maxBal: number) => {
    const cleanVal = Math.min(Math.max(0, val), maxBal);
    setAllocations({ ...allocations, [invoiceId]: cleanVal });
  };

  const handlePayFull = (invoiceId: number, maxBal: number) => {
    const curVal = allocations[invoiceId] || 0;
    const currentTotalWithoutThis = totalAllocated - curVal;
    const canAssign = Math.min(maxBal, Math.max(0, availableAmount - currentTotalWithoutThis));
    setAllocations({ ...allocations, [invoiceId]: canAssign });
  };

  const handleOpenConfirm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessResult(null);

    if (!selectedTxId) {
      setErrorMsg("Please select a verified bank wire receipt.");
      return;
    }
    if (totalAllocated <= 0) {
      setErrorMsg("Please allocate an amount greater than $0 across at least one invoice.");
      return;
    }
    if (totalAllocated > availableAmount) {
      setErrorMsg("Total allocated amount cannot exceed available wire payment amount.");
      return;
    }

    setConfirmModalOpen(true);
  };

  const executeAllocation = async () => {
    setConfirmModalOpen(false);

    const payloadAllocations = Object.entries(allocations)
      .filter(([_, amt]) => Number(amt) > 0)
      .map(([id, amt]) => ({
        invoice_id: parseInt(id),
        amount: Number(amt),
      }));

    try {
      setLoading(true);
      const res = await fetchApi("/accounting/payments/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_transaction_id: parseInt(selectedTxId),
          customer_id: parseInt(selectedCustomerId),
          allocations: payloadAllocations,
          user_name: "Admin",
        }),
      });

      setSuccessResult(res);
      setAllocations({});
      // Refresh invoices
      const data = await fetchApi<Invoice[]>(
        `/accounting/receivables?customer_id=${selectedCustomerId}`
      );
      setInvoices((data || []).filter((i) => i.balance_due > 0));
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit payment allocation.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuickWire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wireAmount <= 0) return;
    try {
      const cust = customers.find((c) => String(c.id) === selectedCustomerId);
      const res = await fetchApi<any>("/accounting/bank-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_account_id: 1, // Default Central Wire Account
          party_type: "CUSTOMER",
          party_id: parseInt(selectedCustomerId),
          party_name: cust ? cust.customer_name : "Customer",
          transaction_type: "CUSTOMER_RECEIPT",
          currency: "USD",
          money_in: wireAmount,
          date: wireDate,
          transaction_reference: wireRef || "Direct TT / Wire Remittance",
          notes: `Customer remittance for multi-invoice payment`,
        }),
      });

      // Reload bank transactions
      const txList = await fetchApi<BankTransaction[]>(
        "/accounting/bank-transactions?transaction_type=CUSTOMER_RECEIPT"
      );
      setBankTxs(txList || []);
      if (res?.transaction_id) {
        setSelectedTxId(String(res.transaction_id));
      }
      setIsQuickWireOpen(false);
      setWireAmount(0);
      setWireRef("");
    } catch (err: any) {
      alert(err.message || "Failed to record bank receipt.");
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-sky-600" />
            Customer Payment Allocation Engine
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Split 1 Customer Payment Across Multiple Commercial Invoices
          </p>
        </div>
      </div>

      <AccountingNav />

      {/* Main Allocation Form & Workflow */}
      <form onSubmit={handleOpenConfirm} className="space-y-6">
        {/* Step 1 & 2: Select Customer & Bank Wire */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Select Customer */}
          <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Select Customer / Buyer
              </h2>
            </div>
            <p className="text-[11px] text-slate-500">
              Choose the Indian buyer whose invoices are being cleared.
            </p>

            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="select w-full text-xs"
            >
              <option value="">-- Choose Buyer --</option>
              {customers.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.customer_name}
                </option>
              ))}
            </select>
          </div>

          {/* Select or Record Bank Wire Receipt */}
          <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Select Bank Wire Receipt
                </h2>
              </div>
              {selectedCustomerId && (
                <button
                  type="button"
                  onClick={() => setIsQuickWireOpen(true)}
                  className="text-xs text-sky-600 hover:text-sky-500 font-bold"
                >
                  + Record New Wire
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Select verified funds received in Bank Ledger to allocate.
            </p>

            <select
              value={selectedTxId}
              onChange={(e) => setSelectedTxId(e.target.value)}
              className="select w-full text-xs"
            >
              <option value="">-- Choose Bank Wire Receipt --</option>
              {bankTxs.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.date} — {t.party_name} — {formatUSD(t.usd_equivalent_in || t.money_in)} ({t.bank_name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Allocation Tracker Bar */}
        {selectedTx && (
          <div className="card p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
            <div>
              <span className="text-slate-500">Available Wire Receipt: </span>
              <b className="text-slate-900 dark:text-slate-100 text-sm">{formatUSD(availableAmount)}</b>
              <span className="text-slate-400 text-[11px] ml-2">({selectedTx.transaction_reference || selectedTx.transaction_code})</span>
            </div>

            <div className="space-x-6">
              <span>
                Total Allocated: <b className="text-emerald-600 text-sm">{formatUSD(totalAllocated)}</b>
              </span>
              <span>
                Remaining:{" "}
                <b className={remainingUnallocated < 0 ? "text-rose-600 text-sm" : "text-sky-600 text-sm"}>
                  {formatUSD(remainingUnallocated)}
                </b>
              </span>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successResult && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold">
                Payment Allocated Successfully!
              </div>
              <div className="text-[11px] opacity-90 mt-0.5">
                Total ${successResult.total_allocated?.toFixed(2)} allocated across {successResult.allocations?.length} invoices. Double-entry journal posted automatically.
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="font-bold">{errorMsg}</div>
          </div>
        )}

        {/* Step 3: Invoices Multi-Allocation Matrix */}
        {selectedCustomerId && (
          <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden space-y-0">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Step 3: Allocate Funds to Specific Invoices
                </h3>
                <p className="text-[11px] text-slate-500">
                  Enter partial or full amounts for each invoice.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {invoices.length} outstanding invoices
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Loading outstanding customer invoices...
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No unpaid or outstanding invoices found for this customer.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block table-container border-0 rounded-none">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="w-24">Date</th>
                        <th className="w-28">Invoice #</th>
                        <th className="text-right w-28">Total Amount</th>
                        <th className="text-right w-28">Already Paid</th>
                        <th className="text-right w-32">Outstanding Balance</th>
                        <th className="text-center w-28">Status</th>
                        <th className="text-right w-44">Allocate (USD)</th>
                        <th className="text-center w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => {
                        const curVal = allocations[inv.id] || "";
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                              {inv.date}
                            </td>
                            <td className="font-mono font-bold text-sky-600 dark:text-sky-400 text-xs">
                              {inv.invoice_number}
                            </td>
                            <td className="text-right font-mono text-xs">
                              {formatUSD(inv.total_amount)}
                            </td>
                            <td className="text-right font-mono text-xs text-emerald-600">
                              {formatUSD(inv.amount_received)}
                            </td>
                            <td className="text-right font-mono font-black text-xs text-rose-600">
                              {formatUSD(inv.balance_due)}
                            </td>
                            <td className="text-center">
                              <span
                                className={`badge text-[9px] ${
                                  inv.payment_status === "PAID"
                                    ? "badge-success"
                                    : inv.payment_status === "PARTIALLY PAID"
                                    ? "badge-warning"
                                    : "badge-danger"
                                }`}
                              >
                                {inv.payment_status}
                              </span>
                            </td>
                            <td className="text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={inv.balance_due}
                                placeholder="0.00"
                                value={curVal}
                                onChange={(e) =>
                                  handleAmountChange(
                                    inv.id,
                                    parseFloat(e.target.value) || 0,
                                    inv.balance_due
                                  )
                                }
                                className="input font-mono text-right text-xs py-1 w-32 min-h-[38px]"
                              />
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                onClick={() => handlePayFull(inv.id, inv.balance_due)}
                                className="btn btn-secondary py-1 px-2.5 text-[10px] font-bold min-h-[38px]"
                              >
                                Pay Full
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View (iPhone / Coarse Touch Devices) */}
                <div className="md:hidden space-y-3 p-3">
                  {invoices.map((inv) => {
                    const curVal = allocations[inv.id] || "";
                    const isAllocated = Number(curVal) > 0;
                    return (
                      <div
                        key={inv.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isAllocated
                            ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-800"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                          <div>
                            <div className="font-mono font-black text-sm text-sky-600 dark:text-sky-400">
                              {inv.invoice_number}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Date: {inv.date}
                            </div>
                          </div>
                          <span
                            className={`badge text-[9px] ${
                              inv.payment_status === "PAID"
                                ? "badge-success"
                                : inv.payment_status === "PARTIALLY PAID"
                                ? "badge-warning"
                                : "badge-danger"
                            }`}
                          >
                            {inv.payment_status}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 py-2 text-center text-xs border-b border-slate-100 dark:border-slate-800/60">
                          <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Total</div>
                            <div className="font-mono font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                              {formatUSD(inv.total_amount)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Paid</div>
                            <div className="font-mono font-semibold text-emerald-600 mt-0.5">
                              {formatUSD(inv.amount_received)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-rose-500 font-bold uppercase">Balance</div>
                            <div className="font-mono font-black text-rose-600 mt-0.5">
                              {formatUSD(inv.balance_due)}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2.5 flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                              Allocate (USD):
                            </label>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              max={inv.balance_due}
                              placeholder="0.00"
                              value={curVal}
                              onChange={(e) =>
                                handleAmountChange(
                                  inv.id,
                                  parseFloat(e.target.value) || 0,
                                  inv.balance_due
                                )
                              }
                              className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-[44px]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePayFull(inv.id, inv.balance_due)}
                            className="self-end px-3 py-2 text-xs font-bold rounded-xl bg-sky-100 hover:bg-sky-200 dark:bg-sky-950 text-sky-800 dark:text-sky-300 min-h-[44px]"
                          >
                            Pay Full
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Action Button Bar */}
        {selectedCustomerId && invoices.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500">
              * Integrity check: payments never create duplicate sales revenue.
            </div>
            <button
              type="submit"
              disabled={loading || totalAllocated <= 0 || remainingUnallocated < 0}
              className="btn btn-primary px-6 py-2.5 text-xs font-bold shadow-md disabled:opacity-50 min-h-[44px]"
            >
              Confirm & Post Payment Allocation
            </button>
          </div>
        )}
      </form>

      {/* Mobile Sticky Allocation Bar (iPhone) */}
      {selectedCustomerId && invoices.length > 0 && (
        <div className="md:hidden fixed bottom-14 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 shadow-lg no-print">
          <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
            <div className="leading-tight">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                Allocated / Available
              </div>
              <div className="font-mono font-black text-xs text-slate-900 dark:text-white">
                <span className="text-emerald-600 dark:text-emerald-400">{formatUSD(totalAllocated)}</span>
                {" / "}
                <span>{formatUSD(availableAmount)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenConfirm}
              disabled={loading || totalAllocated <= 0 || remainingUnallocated < 0}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-xs shadow-md shadow-sky-600/20 disabled:opacity-50 transition-all flex items-center space-x-1.5 min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Post Allocation</span>
            </button>
          </div>
        </div>
      )}

      {/* Financial Confirmation Bottom Sheet / Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom pb-safe">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-sky-600" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  Confirm Payment Allocation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-2 text-xs border border-slate-200/80 dark:border-slate-700">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {customers.find((c) => String(c.id) === selectedCustomerId)?.customer_name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500">Wire Transaction:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {selectedTx?.transaction_code} ({selectedTx?.bank_name})
                </span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500">Wire Available Amount:</span>
                <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                  {formatUSD(availableAmount)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500">Allocated to Invoices:</span>
                <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {formatUSD(totalAllocated)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500">Remaining Unallocated:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {formatUSD(remainingUnallocated)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              This will settle the selected invoices and reduce Accounts Receivable without duplicating revenue.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeAllocation}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-black text-xs shadow-md shadow-sky-600/20 disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? "Allocating..." : "Confirm & Post"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Quick Wire Modal */}
      {isQuickWireOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-sky-600" />
                Record Incoming Bank Wire
              </h3>
              <button
                onClick={() => setIsQuickWireOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuickWire} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">Remittance Amount (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 50000.00"
                  value={wireAmount || ""}
                  onChange={(e) => setWireAmount(parseFloat(e.target.value) || 0)}
                  className="input font-mono text-sm w-full"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Receipt Date *</label>
                <input
                  type="date"
                  required
                  value={wireDate}
                  onChange={(e) => setWireDate(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Bank Wire Reference / MT103</label>
                <input
                  type="text"
                  placeholder="SWIFT ref, UTR number, TT #"
                  value={wireRef}
                  onChange={(e) => setWireRef(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuickWireOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary font-bold">
                  Record Wire Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
