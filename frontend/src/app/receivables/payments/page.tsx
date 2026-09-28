"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Receipt,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Landmark,
  ArrowDownRight,
  Layers,
  ArrowRight,
  FileCheck2,
  Printer,
  Download,
  PlusCircle,
  DollarSign,
  Scale,
  Calendar,
  Building,
  CreditCard,
  FileText,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  X,
} from "lucide-react";
import { fetchApi, formatUSD, API_BASE } from "@/lib/api";
import { BankingNav } from "@/components/BankingNav";

interface CustomerOption {
  id: number;
  customer_name: string;
  contact_person?: string;
  phone?: string;
}

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  currency: string;
  account_type?: string;
  gl_account_code?: string;
}

interface InvoiceItem {
  invoice_id: number;
  invoice_number: string;
  date: string;
  amount: number;
  received: number;
  balance: number;
  days_outstanding: number;
  status: string;
}

interface CustomerAgingData {
  customer_id: number;
  customer_name: string;
  current_0_30: number;
  aging_31_60: number;
  aging_61_90: number;
  overdue_90_plus: number;
  total_outstanding: number;
  invoices: InvoiceItem[];
}

function CustomerReceiptsWorkbenchContent() {
  const searchParams = useSearchParams();
  const preselectedCustId = searchParams.get("customer_id")
    ? parseInt(searchParams.get("customer_id")!)
    : null;

  // Master Lists
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [agingMap, setAgingMap] = useState<{ [custId: number]: CustomerAgingData }>({});

  // Selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(preselectedCustId);
  const [selectedBankId, setSelectedBankId] = useState<number>(1);
  const [customerInvoices, setCustomerInvoices] = useState<InvoiceItem[]>([]);

  // Receipt Form Fields
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [reference, setReference] = useState("");
  const [mt103Reference, setMt103Reference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Wire Transfer");
  const [notes, setNotes] = useState("");

  // Allocation States
  const [allocationMode, setAllocationMode] = useState<"OLDEST_FIRST" | "MANUAL">("OLDEST_FIRST");
  const [manualAllocations, setManualAllocations] = useState<{ [invoiceId: number]: number }>({});
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<{ [invoiceId: number]: boolean }>({});

  // UI States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [successResult, setSuccessResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  // Load Master Data
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [custs, banks, agingRes] = await Promise.all([
        fetchApi<CustomerOption[]>("/customers"),
        fetchApi<BankAccount[]>("/accounting/banks"),
        fetchApi<any>("/accounting/receivables/aging"),
      ]);

      setCustomers(custs || []);
      setBankAccounts(banks || []);

      if (banks && banks.length > 0) {
        setSelectedBankId(banks[0].id);
      }

      const aMap: { [id: number]: CustomerAgingData } = {};
      if (agingRes && agingRes.customers) {
        agingRes.customers.forEach((c: CustomerAgingData) => {
          aMap[c.customer_id] = c;
        });
        setAgingMap(aMap);
      }

      // Preselect customer
      const targetId = preselectedCustId || (custs && custs.length > 0 ? custs[0].id : null);
      if (targetId) {
        setSelectedCustomerId(targetId);
        if (aMap[targetId]) {
          setCustomerInvoices(aMap[targetId].invoices || []);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load initial financial master records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Update Invoices when customer changes
  useEffect(() => {
    if (selectedCustomerId && agingMap[selectedCustomerId]) {
      const invs = agingMap[selectedCustomerId].invoices || [];
      setCustomerInvoices(invs);

      // Select all by default
      const selMap: { [id: number]: boolean } = {};
      invs.forEach((inv) => {
        selMap[inv.invoice_id] = true;
      });
      setSelectedInvoiceIds(selMap);
      setManualAllocations({});
    } else {
      setCustomerInvoices([]);
      setSelectedInvoiceIds({});
      setManualAllocations({});
    }
  }, [selectedCustomerId, agingMap]);

  // Active Entities
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const selectedBank = useMemo(
    () => bankAccounts.find((b) => b.id === selectedBankId),
    [bankAccounts, selectedBankId]
  );

  const customerAging = useMemo(
    () => (selectedCustomerId ? agingMap[selectedCustomerId] : null),
    [selectedCustomerId, agingMap]
  );

  // Currency & USD Equivalent
  const usdEquivalent = useMemo(() => {
    if (currency === "USD") return amount;
    return exchangeRate > 0 ? amount / exchangeRate : 0;
  }, [amount, currency, exchangeRate]);

  // Compute Live Allocations Per Invoice
  const computedAllocations = useMemo(() => {
    const allocs: { [invoiceId: number]: number } = {};
    if (usdEquivalent <= 0) return allocs;

    if (allocationMode === "OLDEST_FIRST") {
      // Sort oldest first by date
      const sorted = [...customerInvoices].sort((a, b) => (a.date > b.date ? 1 : -1));
      let remaining = usdEquivalent;
      for (const inv of sorted) {
        if (!selectedInvoiceIds[inv.invoice_id]) continue;
        if (remaining <= 0) {
          allocs[inv.invoice_id] = 0;
          continue;
        }
        const needed = inv.balance;
        const take = Math.min(needed, remaining);
        allocs[inv.invoice_id] = take;
        remaining -= take;
      }
    } else {
      // Manual Mode: use manualAllocations directly
      customerInvoices.forEach((inv) => {
        allocs[inv.invoice_id] = manualAllocations[inv.invoice_id] || 0;
      });
    }
    return allocs;
  }, [usdEquivalent, allocationMode, customerInvoices, selectedInvoiceIds, manualAllocations]);

  // Aggregate Numbers
  const totalInvoiceAmount = useMemo(
    () => customerInvoices.reduce((sum, inv) => sum + inv.amount, 0),
    [customerInvoices]
  );

  const totalBalanceDue = useMemo(
    () => customerInvoices.reduce((sum, inv) => sum + inv.balance, 0),
    [customerInvoices]
  );

  const totalAllocated = useMemo(() => {
    return Object.values(computedAllocations).reduce((sum, v) => sum + (v || 0), 0);
  }, [computedAllocations]);

  const estimatedAdvance = useMemo(() => {
    return Math.max(0, usdEquivalent - totalAllocated);
  }, [usdEquivalent, totalAllocated]);

  const totalRemainingBalance = useMemo(() => {
    return Math.max(0, totalBalanceDue - totalAllocated);
  }, [totalBalanceDue, totalAllocated]);

  // Invoice Handlers
  const handleToggleInvoice = (invId: number) => {
    setSelectedInvoiceIds((prev) => ({
      ...prev,
      [invId]: !prev[invId],
    }));
  };

  const handleSelectAllInvoices = (selectAll: boolean) => {
    const selMap: { [id: number]: boolean } = {};
    customerInvoices.forEach((inv) => {
      selMap[inv.invoice_id] = selectAll;
    });
    setSelectedInvoiceIds(selMap);
  };

  const handleManualAllocationChange = (invId: number, val: number, maxVal: number) => {
    const clamped = Math.max(0, Math.min(val, maxVal));
    setManualAllocations((prev) => ({
      ...prev,
      [invId]: clamped,
    }));
  };

  const handlePayFullInvoice = (invId: number, fullAmt: number) => {
    setManualAllocations((prev) => ({
      ...prev,
      [invId]: fullAmt,
    }));
  };

  const handleAutoAllocate = () => {
    setAllocationMode("OLDEST_FIRST");
    handleSelectAllInvoices(true);
  };

  const handleResetForm = () => {
    setAmount(0);
    setReference("");
    setMt103Reference("");
    setNotes("");
    setSuccessResult(null);
    setError(null);
    setManualAllocations({});
  };

  // Submit Customer Receipt
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedBankId || amount <= 0) {
      setError("Please select a customer, receiving bank account, and enter a valid receipt amount.");
      return;
    }

    if (allocationMode === "MANUAL" && totalAllocated > usdEquivalent) {
      setError(
        `Total allocated to invoices (${formatUSD(totalAllocated)}) exceeds receipt amount (${formatUSD(usdEquivalent)}).`
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload: any = {
        customer_id: selectedCustomerId,
        bank_account_id: selectedBankId,
        date: receiptDate,
        amount,
        currency,
        exchange_rate: exchangeRate,
        reference: reference || null,
        transaction_reference: reference || null,
        mt103_reference: mt103Reference || null,
        payment_method: paymentMethod,
        notes: notes || null,
        allocation_mode: allocationMode,
      };

      if (allocationMode === "MANUAL") {
        payload.manual_allocations = Object.entries(manualAllocations)
          .filter(([_, amt]) => amt > 0)
          .map(([invId, amt]) => ({
            invoice_id: parseInt(invId),
            amount: amt,
          }));
      }

      const res = await fetchApi<any>("/accounting/payments/customer-receipt", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccessResult(res);

      // Refresh Aging Data
      const agingRes = await fetchApi<any>("/accounting/receivables/aging");
      if (agingRes && agingRes.customers) {
        const aMap: { [id: number]: CustomerAgingData } = {};
        agingRes.customers.forEach((c: CustomerAgingData) => {
          aMap[c.customer_id] = c;
        });
        setAgingMap(aMap);
        if (selectedCustomerId && aMap[selectedCustomerId]) {
          setCustomerInvoices(aMap[selectedCustomerId].invoices || []);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process customer receipt.");
    } finally {
      setSubmitting(false);
    }
  };

  // PDF Download Handler
  const handleDownloadPDF = async (isOfficial = false) => {
    try {
      setDownloadingPdf(true);
      let downloadUrl = "";
      let filename = `AQ-COMPANIES-CUSTOMER-RECEIPT-${receiptDate}.pdf`;

      if (isOfficial && successResult && (successResult.receipt_id || successResult.bank_transaction_id)) {
        const receiptId = successResult.receipt_id || successResult.bank_transaction_id;
        downloadUrl = `${API_BASE}/receivables/receipts/${receiptId}/pdf`;
        filename = `AQ-COMPANIES-CUSTOMER-RECEIPT-${successResult.transaction_code || receiptId}.pdf`;

        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error("Failed to fetch official receipt PDF.");
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // Generate Draft Preview PDF
        const allocList = customerInvoices.map((inv) => ({
          invoice_id: inv.invoice_id,
          invoice_number: inv.invoice_number,
          date: inv.date,
          total_amount: inv.amount,
          previously_received: inv.received,
          allocated_amount: computedAllocations[inv.invoice_id] || 0,
        }));

        const draftPayload = {
          customer_id: selectedCustomerId,
          bank_account_id: selectedBankId,
          receipt_date: receiptDate,
          amount: amount,
          currency: currency,
          reference: reference || "N/A",
          mt103_reference: mt103Reference || null,
          notes: notes || null,
          allocations: allocList,
        };

        const response = await fetch(`${API_BASE}/receivables/receipts/pdf-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload),
        });

        if (!response.ok) throw new Error("Failed to generate preview PDF.");
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to download receipt PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* 6. Top Page Header & Action Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs no-print">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="px-2.5 py-1 text-[10px] font-black tracking-wider rounded-md uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              RECEIVABLES SETTLEMENT
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Double-Entry GL Authoritative
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Customer Receipts & Payment Allocation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Apply incoming wire receipts to customer open invoices or credit advances. Supports Oldest-First (FIFO) and Manual allocation modes.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-2 self-stretch md:self-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs transition-all"
            title="Print Official Voucher"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Voucher</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadPDF(!!successResult)}
            disabled={downloadingPdf || amount <= 0}
            className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs transition-all disabled:opacity-50"
            title="Download PDF Document"
          >
            <Download className={`w-4 h-4 text-sky-600 ${downloadingPdf ? "animate-bounce" : ""}`} />
            <span>{downloadingPdf ? "Generating..." : successResult ? "Official PDF" : "Draft PDF"}</span>
          </button>

          <button
            type="button"
            onClick={handleResetForm}
            className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-slate-500" />
            <span>New Receipt</span>
          </button>

          <Link
            href="/receivables"
            className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <span>Aging Hub →</span>
          </Link>
        </div>
      </div>

      {/* 7. Secondary Banking Nav */}
      <BankingNav />

      {/* Notification / Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center space-x-2.5 shadow-2xs no-print">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Success Notification Banner */}
      {successResult && (
        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs space-y-3 shadow-2xs no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="font-black text-sm text-emerald-950 dark:text-emerald-200">
                  Customer Receipt Successfully Posted & Balanced!
                </h4>
                <p className="text-emerald-800 dark:text-emerald-300 text-[11px] mt-0.5">
                  Bank Transaction: <strong>{successResult.transaction_code}</strong> • Journal Voucher:{" "}
                  <strong>{successResult.journal_entry_number}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleDownloadPDF(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Official PDF</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 text-[11px]">
            <div>
              <span className="text-emerald-700 dark:text-emerald-400">Total Receipt:</span>
              <div className="font-black font-mono text-emerald-900 dark:text-white text-xs">
                {formatUSD(successResult.total_receipt_usd)}
              </div>
            </div>
            <div>
              <span className="text-emerald-700 dark:text-emerald-400">Applied to AR (1100):</span>
              <div className="font-black font-mono text-emerald-900 dark:text-white text-xs">
                {formatUSD(successResult.allocated_to_invoices_usd)}
              </div>
            </div>
            <div>
              <span className="text-emerald-700 dark:text-emerald-400">Customer Advance (2150):</span>
              <div className="font-black font-mono text-amber-700 dark:text-amber-300 text-xs">
                {formatUSD(successResult.unallocated_advance_usd)}
              </div>
            </div>
            <div>
              <span className="text-emerald-700 dark:text-emerald-400">Bank Running Bal:</span>
              <div className="font-black font-mono text-slate-800 dark:text-slate-200 text-xs">
                {formatUSD(successResult.bank_new_balance)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: 2 Columns Left (Cards 8, 9, 10), 1 Column Right (Cards 12, 13, 14) */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* 8. Receipt Information Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Receipt Information
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Mandatory Bank & Customer Parameters</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Customer Account Picker */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Customer Account <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="Search / filter customer..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <select
                    value={selectedCustomerId || ""}
                    onChange={(e) => setSelectedCustomerId(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden min-h-[44px]"
                    required
                  >
                    <option value="" disabled>
                      -- Select Customer ({customers.filter(c => c.customer_name.toLowerCase().includes(customerSearch.toLowerCase())).length}) --
                    </option>
                    {customers
                      .filter((c) => c.customer_name.toLowerCase().includes(customerSearch.toLowerCase()))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.customer_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Receiving Bank / Vault */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Receiving Bank / Vault Account <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden min-h-[44px]"
                  required
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} — {b.currency} ({b.account_number})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid 3 Columns: Date, Currency, Exchange Rate */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Receipt Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-mono min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Currency <span className="text-rose-500">*</span>
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden min-h-[44px]"
                >
                  <option value="USD">USD ($ - US Dollar)</option>
                  <option value="AFN">AFN (؋ - Afghan Afghani)</option>
                  <option value="AED">AED (AED - UAE Dirham)</option>
                  <option value="EUR">EUR (€ - Euro)</option>
                  <option value="INR">INR (₹ - Indian Rupee)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Exchange Rate {currency !== "USD" && <span className="text-amber-500">(1 USD =)</span>}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  disabled={currency === "USD"}
                  value={currency === "USD" ? 1.0 : exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1.0)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden disabled:bg-slate-100 dark:disabled:bg-slate-800/50 min-h-[44px]"
                />
              </div>
            </div>

            {/* Grid 3 Columns: Amount, Reference, Payment Method */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Receipt Amount ({currency}) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount || ""}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-3 py-2 text-sm font-black font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Reference / Wire #
                </label>
                <input
                  type="text"
                  placeholder="e.g. WT-AUB-882194"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                >
                  <option value="Bank Wire Transfer">Bank Wire Transfer</option>
                  <option value="SWIFT MT103">SWIFT MT103</option>
                  <option value="Sarafi / Hawala">Sarafi / Hawala</option>
                  <option value="Cash Deposit">Cash Deposit</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            {/* Row 3: SWIFT MT103 Ref & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  SWIFT / MT103 Reference
                </label>
                <input
                  type="text"
                  placeholder="MT103-2026-..."
                  value={mt103Reference}
                  onChange={(e) => setMt103Reference(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Notes / Payment Memo
                </label>
                <input
                  type="text"
                  placeholder="Additional notes for bank wire or customer ledger voucher..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-normal rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* 9. Customer Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Building className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Customer Financial Snapshot:{" "}
                  <span className="text-sky-600 dark:text-sky-400">
                    {selectedCustomer?.customer_name || "None"}
                  </span>
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                CID #{selectedCustomerId || 0}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Open Receivables
                </span>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white mt-1">
                  {formatUSD(totalBalanceDue)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Open Invoices Count
                </span>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white mt-1">
                  {customerInvoices.length} Invoices
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  0-30 Days (Current)
                </span>
                <div className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatUSD(customerAging?.current_0_30 || 0)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Overdue (&gt;30 Days)
                </span>
                <div className="text-base font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                  {formatUSD(
                    (customerAging?.aging_31_60 || 0) +
                      (customerAging?.aging_61_90 || 0) +
                      (customerAging?.overdue_90_plus || 0)
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 10 & 11. Open Invoices Allocation Table & Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            {/* Table Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Open Invoices Allocation ({customerInvoices.length})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select allocation mode: Oldest First (Auto FIFO) or specify manual amounts per invoice.
                </p>
              </div>

              {/* Mode Toggle & Quick Controls */}
              <div className="flex items-center space-x-2">
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setAllocationMode("OLDEST_FIRST")}
                    className={`px-3 py-1 font-bold rounded-lg transition-colors ${
                      allocationMode === "OLDEST_FIRST"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Oldest First (Auto FIFO)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMode("MANUAL")}
                    className={`px-3 py-1 font-bold rounded-lg transition-colors ${
                      allocationMode === "MANUAL"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Manual Allocation
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAutoAllocate}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  Auto Allocate
                </button>
              </div>
            </div>

            {/* Table Container (Desktop / Tablets) */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          customerInvoices.length > 0 &&
                          customerInvoices.every((i) => selectedInvoiceIds[i.invoice_id])
                        }
                        onChange={(e) => handleSelectAllInvoices(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                      />
                    </th>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Total Amount</th>
                    <th className="py-2.5 px-3 text-right">Received</th>
                    <th className="py-2.5 px-3 text-right">Balance Due</th>
                    <th className="py-2.5 px-3 text-right">Allocate Now (USD)</th>
                    <th className="py-2.5 px-3 text-right">Remaining</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {customerInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400">
                        <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <div>No open invoices found for this customer.</div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Full receipt amount will be credited to{" "}
                          <strong className="text-amber-600">Account 2150 (Customer Advances)</strong>.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    customerInvoices.map((inv) => {
                      const isSelected = !!selectedInvoiceIds[inv.invoice_id];
                      const allocatedNow = computedAllocations[inv.invoice_id] || 0;
                      const remainingDue = Math.max(0, inv.balance - allocatedNow);
                      const isFullySettled = allocatedNow > 0 && remainingDue <= 0.001;

                      return (
                        <tr
                          key={inv.invoice_id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                            allocatedNow > 0
                              ? "bg-emerald-50/30 dark:bg-emerald-950/20"
                              : !isSelected
                              ? "opacity-50"
                              : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleInvoice(inv.invoice_id)}
                              className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                            {inv.invoice_number}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                            {inv.date}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-600 dark:text-slate-300 font-mono">
                            {formatUSD(inv.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-500 font-mono">
                            {formatUSD(inv.received)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white font-mono">
                            {formatUSD(inv.balance)}
                          </td>

                          {/* Allocate Now Column */}
                          <td className="py-2.5 px-3 text-right">
                            {allocationMode === "MANUAL" ? (
                              <div className="flex items-center justify-end space-x-1.5">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={inv.balance}
                                  placeholder="0.00"
                                  value={manualAllocations[inv.invoice_id] || ""}
                                  onChange={(e) =>
                                    handleManualAllocationChange(
                                      inv.invoice_id,
                                      parseFloat(e.target.value) || 0,
                                      inv.balance
                                    )
                                  }
                                  className="w-24 px-2 py-1 text-right font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => handlePayFullInvoice(inv.invoice_id, inv.balance)}
                                  className="px-1.5 py-1 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                  title="Allocate full balance due"
                                >
                                  Full
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`font-mono font-black ${
                                  allocatedNow > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-slate-400"
                                }`}
                              >
                                {allocatedNow > 0 ? formatUSD(allocatedNow) : "—"}
                              </span>
                            )}
                          </td>

                          {/* Remaining Balance */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {formatUSD(remainingDue)}
                          </td>

                          {/* Allocation Status Badge */}
                          <td className="py-2.5 px-3 text-center">
                            {isFullySettled ? (
                              <span className="px-2 py-0.5 text-[10px] font-black rounded-md uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                FULLY SETTLED
                              </span>
                            ) : allocatedNow > 0 ? (
                              <span className="px-2 py-0.5 text-[10px] font-black rounded-md uppercase bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                                PARTIAL
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-black rounded-md uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                OPEN
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Table Totals Row */}
                {customerInvoices.length > 0 && (
                  <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-mono font-bold text-xs border-t-2 border-slate-300 dark:border-slate-700">
                    <tr>
                      <td colSpan={3} className="py-3 px-3 uppercase text-slate-600 dark:text-slate-300">
                        Totals ({customerInvoices.length} Invoices)
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                        {formatUSD(totalInvoiceAmount)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400">
                        {formatUSD(totalInvoiceAmount - totalBalanceDue)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-900 dark:text-white font-black">
                        {formatUSD(totalBalanceDue)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black">
                        {formatUSD(totalAllocated)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-900 dark:text-white font-black">
                        {formatUSD(totalRemainingBalance)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Mobile Invoices Card List (iPhone / Small Viewports) */}
            <div className="md:hidden space-y-3">
              {customerInvoices.length === 0 ? (
                <div className="py-8 text-center text-slate-400 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <div>No open invoices found for this customer.</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Full receipt will be credited to <strong className="text-amber-600">Account 2150 (Customer Advances)</strong>.
                  </div>
                </div>
              ) : (
                customerInvoices.map((inv) => {
                  const isSelected = !!selectedInvoiceIds[inv.invoice_id];
                  const allocatedNow = computedAllocations[inv.invoice_id] || 0;
                  const remainingDue = Math.max(0, inv.balance - allocatedNow);
                  const isFullySettled = allocatedNow > 0 && remainingDue <= 0.001;

                  return (
                    <div
                      key={inv.invoice_id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        allocatedNow > 0
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                          : isSelected
                          ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          : "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <label className="flex items-center space-x-2.5 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleInvoice(inv.invoice_id)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <div className="font-mono font-black text-sm text-slate-900 dark:text-white">
                              {inv.invoice_number}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Date: {inv.date}
                            </div>
                          </div>
                        </label>

                        <div>
                          {isFullySettled ? (
                            <span className="px-2 py-0.5 text-[9px] font-black rounded-md uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              SETTLED
                            </span>
                          ) : allocatedNow > 0 ? (
                            <span className="px-2 py-0.5 text-[9px] font-black rounded-md uppercase bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                              PARTIAL
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] font-black rounded-md uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              OPEN
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2.5 text-xs text-center border-b border-slate-100 dark:border-slate-800/60">
                        <div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Invoice</div>
                          <div className="font-mono font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                            {formatUSD(inv.amount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Received</div>
                          <div className="font-mono font-semibold text-slate-500 mt-0.5">
                            {formatUSD(inv.received)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-rose-500 font-bold uppercase">Balance Due</div>
                          <div className="font-mono font-black text-slate-900 dark:text-white mt-0.5">
                            {formatUSD(inv.balance)}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="text-left">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">
                            Allocated:
                          </span>
                          <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                            {allocatedNow > 0 ? formatUSD(allocatedNow) : "—"}
                          </span>
                        </div>

                        {allocationMode === "MANUAL" ? (
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              max={inv.balance}
                              placeholder="0.00"
                              value={manualAllocations[inv.invoice_id] || ""}
                              onChange={(e) =>
                                handleManualAllocationChange(
                                  inv.invoice_id,
                                  parseFloat(e.target.value) || 0,
                                  inv.balance
                                )
                              }
                              className="w-24 px-2 py-1.5 text-right font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs min-h-[40px]"
                            />
                            <button
                              type="button"
                              onClick={() => handlePayFullInvoice(inv.invoice_id, inv.balance)}
                              className="px-2 py-1.5 text-xs font-bold rounded-lg bg-sky-100 hover:bg-sky-200 dark:bg-sky-950 text-sky-800 dark:text-sky-300 min-h-[40px]"
                            >
                              Full
                            </button>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Remaining:
                            </span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                              {formatUSD(remainingDue)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: 12. Allocation Summary, 13. Accounting Impact Preview, 14. Action Controls */}
        <div className="space-y-6">
          {/* 12. Allocation Summary / Live Breakdown Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Scale className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Allocation Breakdown
                </h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                Live Calculation
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Receipt Amount ({currency}):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {currency !== "USD"
                    ? `${Number(amount).toLocaleString()} ${currency}`
                    : formatUSD(amount)}
                </span>
              </div>

              {currency !== "USD" && (
                <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800 text-sky-600 dark:text-sky-400">
                  <span>USD Equivalent:</span>
                  <span className="font-mono font-black">{formatUSD(usdEquivalent)}</span>
                </div>
              )}

              <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Applied to Invoices (AR 1100):</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatUSD(totalAllocated)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-500">Customer Advance (2150):</span>
                  <div className="text-[10px] text-slate-400">Unallocated Excess</div>
                </div>
                <span
                  className={`font-mono font-black text-sm ${
                    estimatedAdvance > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-slate-400"
                  }`}
                >
                  {formatUSD(estimatedAdvance)}
                </span>
              </div>
            </div>

            {/* Informational Callouts */}
            {estimatedAdvance > 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                <strong>Notice:</strong> Excess receipt of{" "}
                <strong className="font-mono">{formatUSD(estimatedAdvance)}</strong> will be safely
                credited to <strong className="underline">Account 2150 (Customer Advances)</strong>.
              </div>
            ) : totalAllocated > 0 && totalAllocated === usdEquivalent ? (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300">
                <strong>Optimal Settlement:</strong> Receipt amount is 100% matched and applied to
                selected invoices.
              </div>
            ) : null}
          </div>

          {/* 13. Accounting Impact Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Journal Entry Preview
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                Balanced GL
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Debit Line */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-mono">
                      DR
                    </span>
                    <span>
                      {selectedBank?.gl_account_code || "1020"} — {selectedBank?.bank_name || "Bank Account"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Asset Increase (Money In)</div>
                </div>
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                  {formatUSD(usdEquivalent)}
                </span>
              </div>

              {/* Credit Line 1: AR */}
              {totalAllocated > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono">
                        CR
                      </span>
                      <span>1100 — Customer Receivables</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Asset Reduction ({selectedCustomer?.customer_name})
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatUSD(totalAllocated)}
                  </span>
                </div>
              )}

              {/* Credit Line 2: Advances */}
              {estimatedAdvance > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono">
                        CR
                      </span>
                      <span>2150 — Customer Advances</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Liability Increase (Prepayment from Customer)
                    </div>
                  </div>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {formatUSD(estimatedAdvance)}
                  </span>
                </div>
              )}
            </div>

            {/* Check equality */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Total Dr = Total Cr:</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                {formatUSD(usdEquivalent)}
              </span>
            </div>
          </div>

          {/* 14. Action Controls & Posting */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3">
            <button
              type="button"
              onClick={() => {
                if (!selectedCustomerId) {
                  setError("Please select a customer.");
                  return;
                }
                if (amount <= 0) {
                  setError("Please enter a valid receipt amount.");
                  return;
                }
                setConfirmModalOpen(true);
              }}
              disabled={submitting || amount <= 0 || !selectedCustomerId}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center space-x-2 min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {submitting ? "Posting Balanced GL..." : "Post Customer Receipt (Balanced GL)"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadPDF(false)}
              disabled={amount <= 0 || downloadingPdf}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span>Preview Receipt Voucher (PDF)</span>
            </button>
          </div>
        </div>
      </form>

      {/* Mobile Sticky Posting Action Bar (iPhone) */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 shadow-lg no-print">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          <div className="leading-tight">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              Allocated / Total
            </div>
            <div className="font-mono font-black text-xs text-slate-900 dark:text-white">
              <span className="text-emerald-600 dark:text-emerald-400">{formatUSD(totalAllocated)}</span>
              {" / "}
              <span>{formatUSD(usdEquivalent)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!selectedCustomerId) {
                setError("Please select a customer.");
                return;
              }
              if (amount <= 0) {
                setError("Please enter a valid receipt amount.");
                return;
              }
              setConfirmModalOpen(true);
            }}
            disabled={submitting || amount <= 0 || !selectedCustomerId}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center space-x-1.5 min-h-[44px]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Post Receipt</span>
          </button>
        </div>
      </div>

      {/* Financial Confirmation Bottom Sheet / Modal (Requirements 19 & 20) */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom pb-safe">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  Confirm Financial Posting
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
                  {selectedCustomer?.customer_name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500">Receiving Bank:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedBank?.bank_name} ({selectedBank?.currency})
                </span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500">Receipt Amount:</span>
                <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                  {formatUSD(amount)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500">Applied to Invoices (AR):</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatUSD(totalAllocated)}
                </span>
              </div>
              {estimatedAdvance > 0 && (
                <div className="flex justify-between py-1 border-t border-slate-200/60 dark:border-slate-700">
                  <span className="text-amber-600">Customer Advance (2150):</span>
                  <span className="font-mono font-bold text-amber-600">
                    {formatUSD(estimatedAdvance)}
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              This will create authoritative balanced double-entry GL journal vouchers and update customer aging instantly. Touch gestures cannot post without this confirmation.
            </p>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  setConfirmModalOpen(false);
                  handleSubmit(e);
                }}
                disabled={submitting}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-1.5 min-h-[44px]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Post</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         15, 16, 17. OFFICIAL PRINTABLE RECEIPT VOUCHER (PRINT ONLY)
         Rendered strictly during browser window.print() execution
         ========================================================================= */}
      <div className="print-only p-8 text-black bg-white">
        {/* Official Header */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black tracking-wider uppercase text-black">AQ COMPANIES</h1>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-widest mt-0.5">
                Trading • Logistics • Accounting
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                Kabul / Dubai • Email: finance@aqcompanies.com • Tel: +93 79 000 0000
              </p>
            </div>
            <div className="text-right">
              <div className="inline-block px-3 py-1 border-2 border-black font-black text-xs uppercase tracking-wider">
                CUSTOMER RECEIPT VOUCHER
              </div>
              <div className="text-[11px] font-mono mt-1 font-bold">
                Voucher #: {successResult?.transaction_code || "DRAFT-PREVIEW"}
              </div>
              <div className="text-[10px] text-gray-600">Date: {receiptDate}</div>
            </div>
          </div>
        </div>

        {/* Voucher Meta Grid */}
        <div className="grid grid-cols-2 gap-6 p-4 border border-gray-300 rounded mb-6 text-xs">
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500">Customer Details:</div>
            <div className="font-bold text-sm text-black mt-0.5">{selectedCustomer?.customer_name}</div>
            <div className="text-[11px] text-gray-600">Customer ID: #{selectedCustomerId}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500">Receiving Bank / Vault:</div>
            <div className="font-bold text-sm text-black mt-0.5">{selectedBank?.bank_name}</div>
            <div className="text-[11px] text-gray-600 font-mono">
              Account #: {selectedBank?.account_number} ({selectedBank?.currency})
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500">Payment Reference:</div>
            <div className="font-mono font-bold text-black mt-0.5">{reference || "N/A"}</div>
            {mt103Reference && (
              <div className="text-[10px] text-gray-600 font-mono">MT103: {mt103Reference}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500">Payment Method:</div>
            <div className="font-bold text-black mt-0.5">{paymentMethod}</div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="mb-6">
          <div className="text-xs font-bold uppercase mb-2">Invoice Settlement Breakdown</div>
          <table className="w-full text-left text-xs border border-gray-300 border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px] border-b border-gray-300">
                <th className="p-2 border-r border-gray-300">Invoice #</th>
                <th className="p-2 border-r border-gray-300">Date</th>
                <th className="p-2 text-right border-r border-gray-300">Total Amount</th>
                <th className="p-2 text-right border-r border-gray-300">Previously Paid</th>
                <th className="p-2 text-right border-r border-gray-300">Allocated This Receipt</th>
                <th className="p-2 text-right">Remaining Balance</th>
              </tr>
            </thead>
            <tbody>
              {customerInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500 italic">
                    No open invoices allocated. Entire receipt credited to Account 2150 (Customer Advances).
                  </td>
                </tr>
              ) : (
                customerInvoices.map((inv) => {
                  const alloc = computedAllocations[inv.invoice_id] || 0;
                  const rem = Math.max(0, inv.balance - alloc);
                  return (
                    <tr key={inv.invoice_id} className="border-b border-gray-200">
                      <td className="p-2 font-mono font-bold border-r border-gray-200">
                        {inv.invoice_number}
                      </td>
                      <td className="p-2 font-mono text-[11px] border-r border-gray-200">{inv.date}</td>
                      <td className="p-2 text-right font-mono border-r border-gray-200">
                        {formatUSD(inv.amount)}
                      </td>
                      <td className="p-2 text-right font-mono border-r border-gray-200">
                        {formatUSD(inv.received)}
                      </td>
                      <td className="p-2 text-right font-mono font-bold border-r border-gray-200">
                        {formatUSD(alloc)}
                      </td>
                      <td className="p-2 text-right font-mono">{formatUSD(rem)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Reconciliation Summary Box */}
        <div className="grid grid-cols-3 gap-4 p-4 border border-gray-300 rounded mb-8 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500">Total Money In:</span>
            <div className="text-base font-black font-mono mt-0.5">{formatUSD(usdEquivalent)}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500">Applied to AR (1100):</span>
            <div className="text-base font-black font-mono mt-0.5 text-gray-800">
              {formatUSD(totalAllocated)}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500">
              Customer Advance (2150):
            </span>
            <div className="text-base font-black font-mono mt-0.5 text-gray-800">
              {formatUSD(estimatedAdvance)}
            </div>
          </div>
        </div>

        {/* 17. Official 3-Column Signature Block */}
        <div className="grid grid-cols-3 gap-8 pt-8 border-t border-gray-300 text-center text-xs mt-12">
          <div>
            <div className="border-t border-black pt-1 font-bold">Prepared By</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Accountant / Cashier</div>
          </div>
          <div>
            <div className="border-t border-black pt-1 font-bold">Approved By</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Finance Director / Controller</div>
          </div>
          <div>
            <div className="border-t border-black pt-1 font-bold">Customer / Representative</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Signature & Official Stamp</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerReceiptsWorkbenchPage() {
  return (
    <React.Suspense
      fallback={<div className="p-8 text-center text-xs text-slate-400">Loading workbench...</div>}
    >
      <CustomerReceiptsWorkbenchContent />
    </React.Suspense>
  );
}
