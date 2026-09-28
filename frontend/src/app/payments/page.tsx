"use client";

import React, { useEffect, useState } from "react";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Info,
  DollarSign,
  Landmark,
  FileText,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import { fetchApi, formatUSD, formatNumber } from "@/lib/api";

interface Customer {
  id: number;
  customer_name: string;
}

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  currency: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  date: string;
  customer_id: number;
  total_amount: number;
  amount_received: number;
  balance_due: number;
  payment_status: string;
}

export default function PaymentsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Payment form state
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [totalPaymentReceived, setTotalPaymentReceived] = useState<number>(0);
  const [paymentReference, setPaymentReference] = useState<string>("SWIFT TT-");
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  // Allocation per invoice: { [invoiceId: number]: number }
  const [allocations, setAllocations] = useState<{ [key: number]: number }>({});

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const [cData, bData] = await Promise.all([
          fetchApi<Customer[]>("/customers"),
          fetchApi<BankAccount[]>("/bank-accounts"),
        ]);
        setCustomers(cData || []);
        setBankAccounts(bData || []);
        if (cData && cData.length > 0) setSelectedCustomerId(String(cData[0].id));
        if (bData && bData.length > 0) setBankAccountId(String(bData[0].id));
      } catch (err: any) {
        console.error(err);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedCustomerId) return;
    async function loadCustInvoices() {
      try {
        setLoadingInvoices(true);
        setAllocations({});
        const allInvoices = await fetchApi<Invoice[]>("/invoices");
        const filtered = (allInvoices || []).filter(
          (inv) => String(inv.customer_id) === selectedCustomerId && Number(inv.balance_due) > 0
        );
        setInvoices(filtered);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoadingInvoices(false);
      }
    }
    loadCustInvoices();
  }, [selectedCustomerId]);

  const handleManualAllocation = (invId: number, val: number) => {
    setAllocations((prev) => ({
      ...prev,
      [invId]: Math.max(0, val),
    }));
  };

  const handleAutoAllocateFIFO = () => {
    let remaining = Number(totalPaymentReceived);
    const newAlloc: { [key: number]: number } = {};

    // Sort invoices oldest first
    const sorted = [...invoices].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const inv of sorted) {
      if (remaining <= 0) {
        newAlloc[inv.id] = 0;
        continue;
      }
      const due = Number(inv.balance_due);
      if (remaining >= due) {
        newAlloc[inv.id] = due;
        remaining -= due;
      } else {
        newAlloc[inv.id] = remaining;
        remaining = 0;
      }
    }
    setAllocations(newAlloc);
  };

  const totalAllocated = Object.values(allocations).reduce((sum, v) => sum + Number(v || 0), 0);
  const remainingUnallocated = Number(totalPaymentReceived) - totalAllocated;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedCustomerId) {
      setErrorMsg("Please select a customer");
      return;
    }
    if (!bankAccountId) {
      setErrorMsg("Please select a deposit bank account");
      return;
    }
    if (totalPaymentReceived <= 0) {
      setErrorMsg("Payment amount must be greater than $0.00");
      return;
    }
    if (totalAllocated <= 0) {
      setErrorMsg("Please allocate at least some payment against an invoice");
      return;
    }
    if (totalAllocated > totalPaymentReceived) {
      setErrorMsg("Total allocated cannot exceed payment received");
      return;
    }

    const selCust = customers.find((c) => String(c.id) === selectedCustomerId);
    const allocationList = Object.entries(allocations)
      .filter(([_, amt]) => Number(amt) > 0)
      .map(([invId, amt]) => ({
        invoice_id: Number(invId),
        amount: Number(amt),
      }));

    try {
      setSubmitting(true);
      await fetchApi("/bank-transactions", {
        method: "POST",
        body: JSON.stringify({
          bank_account_id: Number(bankAccountId),
          date: paymentDate,
          party_type: "CUSTOMER",
          party_id: Number(selectedCustomerId),
          party_name: selCust?.customer_name || "Customer",
          transaction_type: "CUSTOMER RECEIPT",
          currency: "USD",
          money_in: Number(totalPaymentReceived),
          money_out: 0,
          exchange_rate: 1.0,
          transaction_reference: paymentReference,
          notes: paymentNotes || `Allocated across ${allocationList.length} invoices`,
          allocations: allocationList,
        }),
      });

      setSuccessMsg(
        `Successfully allocated ${formatUSD(totalAllocated)} across ${allocationList.length} invoices!`
      );
      setTotalPaymentReceived(0);
      setAllocations({});
      // Refresh invoices
      const allInvoices = await fetchApi<Invoice[]>("/invoices");
      const filtered = (allInvoices || []).filter(
        (inv) => String(inv.customer_id) === selectedCustomerId && Number(inv.balance_due) > 0
      );
      setInvoices(filtered);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process payment allocation");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCustomerTotalDue = invoices.reduce((sum, i) => sum + Number(i.balance_due || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <CreditCard className="w-7 h-7 text-emerald-600" />
          Multi-Invoice Payment Allocation
        </h1>
        <p className="text-sm text-slate-500">
          Match Incoming Bank Wire Payments against Unpaid Customer Commercial Invoices
        </p>
      </div>

      {/* Accounting Integrity Note */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950">
          <p className="font-bold">Accounting Rule Enforced:</p>
          <p className="mt-0.5 text-emerald-800">
            Customer payments <b>REDUCE customer receivable</b> and <b>INCREASE bank balance</b>. They do <b>NOT</b> create
            new sales revenue, eliminating double counting.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 text-sm font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-700" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Payment Header Details */}
        <div className="card p-6 bg-white shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center">
              1
            </span>
            Bank Payment Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Customer / Buyer *</label>
              <select
                className="select text-sm w-full font-bold"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Deposit Bank Account *</label>
              <select
                className="select text-sm w-full"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                required
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} ({b.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Payment Date *</label>
              <input
                type="date"
                className="input text-sm w-full"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Amount Received ($ USD) *</label>
              <input
                type="number"
                step="0.01"
                className="input text-base font-black text-emerald-700 w-full"
                value={totalPaymentReceived || ""}
                onChange={(e) => setTotalPaymentReceived(Number(e.target.value))}
                placeholder="50,000.00"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">SWIFT / Bank Reference *</label>
              <input
                type="text"
                className="input text-sm w-full font-mono"
                placeholder="e.g. SWIFT TT-2026-9912 or UTR #12345678"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Payment Notes / Remarks</label>
              <input
                type="text"
                className="input text-sm w-full"
                placeholder="Third-party remitter, invoice notes, etc."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Step 2: Invoice Selection & Allocation */}
        <div className="card p-6 bg-white shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center">
                  2
                </span>
                Allocate Across Invoices
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Total Outstanding for this Customer: <b>{formatUSD(selectedCustomerTotalDue)}</b>
              </p>
            </div>

            <button
              type="button"
              onClick={handleAutoAllocateFIFO}
              disabled={totalPaymentReceived <= 0 || invoices.length === 0}
              className="btn btn-secondary text-xs flex items-center gap-1.5 font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Auto-Allocate (FIFO - Oldest First)
            </button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Date</th>
                  <th className="text-right">Total Invoice</th>
                  <th className="text-right">Already Received</th>
                  <th className="text-right">Current Due</th>
                  <th className="text-right w-44">Allocated Amount ($)</th>
                  <th className="text-right">Remaining Due</th>
                </tr>
              </thead>
              <tbody>
                {loadingInvoices ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Loading customer invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No unpaid invoices found for this customer. All invoices fully settled!
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const currentAlloc = allocations[inv.id] || 0;
                    const remainingAfterAlloc = Number(inv.balance_due) - currentAlloc;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="font-bold text-slate-900">{inv.invoice_number}</td>
                        <td className="text-xs text-slate-500">{inv.date}</td>
                        <td className="text-right font-medium">{formatUSD(inv.total_amount)}</td>
                        <td className="text-right font-medium text-emerald-600">
                          {formatUSD(inv.amount_received)}
                        </td>
                        <td className="text-right font-bold text-rose-600">
                          {formatUSD(inv.balance_due)}
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            step="0.01"
                            max={Number(inv.balance_due)}
                            className="input text-sm text-right font-bold text-slate-900 w-full"
                            value={currentAlloc || ""}
                            placeholder="0.00"
                            onChange={(e) => handleManualAllocation(inv.id, Number(e.target.value))}
                          />
                        </td>
                        <td className="text-right font-semibold text-slate-700">
                          {formatUSD(Math.max(0, remainingAfterAlloc))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Allocation Summary Bar */}
          <div className="p-4 bg-slate-50 border rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-slate-500 block">Total Received:</span>
                <span className="text-base font-extrabold text-slate-900">
                  {formatUSD(totalPaymentReceived)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Allocated:</span>
                <span className="text-base font-extrabold text-emerald-600">
                  {formatUSD(totalAllocated)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Unallocated Balance:</span>
                <span
                  className={`text-base font-extrabold ${
                    remainingUnallocated < 0
                      ? "text-rose-600"
                      : remainingUnallocated > 0
                      ? "text-amber-600"
                      : "text-slate-600"
                  }`}
                >
                  {formatUSD(remainingUnallocated)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || totalAllocated <= 0}
              className="btn btn-primary px-6 py-2.5 text-sm font-bold flex items-center gap-2"
            >
              {submitting ? "Processing..." : "Confirm & Post Payment"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
