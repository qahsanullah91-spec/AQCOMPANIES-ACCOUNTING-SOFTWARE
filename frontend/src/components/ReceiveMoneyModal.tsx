"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  DollarSign,
  Search,
  Check,
  ChevronRight,
  ArrowRight,
  RotateCw,
  X,
  CreditCard,
  Building,
  Calendar,
  AlertCircle,
  FileCheck2,
  ShieldCheck,
  Building2,
  Share2,
  Download,
  FileText,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { fetchApi, formatUSD, formatCurrency } from "@/lib/api";
import { QuickCopy } from "@/components/QuickCopy";

interface ReceiveMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface CustomerOption {
  id: number;
  customer_name: string;
  outstanding_balance?: number;
  open_invoices_count?: number;
  invoices?: any[];
}

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  currency: string;
}

export function ReceiveMoneyModal({ isOpen, onClose, onSuccess }: ReceiveMoneyModalProps) {
  // Step flow: SELECT_CUSTOMER -> ENTER_FORM -> ALLOCATE -> REVIEW -> POST_SUCCESS / POST_FAILURE
  const [step, setStep] = useState<
    "SELECT_CUSTOMER" | "ENTER_FORM" | "ALLOCATE" | "REVIEW" | "POST_SUCCESS" | "POST_FAILURE"
  >("SELECT_CUSTOMER");

  const [activeCompany, setActiveCompany] = useState<string>("AQ COMPANIES");

  // Customers & Banks Data
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [recentCustomerIds, setRecentCustomerIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Form Fields (Req 10: Order: Customer, Amount, Receiving Account, Currency, Date, Reference, MT103, Notes)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [amountStr, setAmountStr] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [mt103Number, setMt103Number] = useState("");
  const [notes, setNotes] = useState("");

  // Invoices & Allocations (Req 14, 15)
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const [manualAllocations, setManualAllocations] = useState<{ [id: number]: number }>({});
  const [allocationMode, setAllocationMode] = useState<"OLDEST_FIRST" | "MANUAL">("OLDEST_FIRST");

  // Posting & Result States (Req 18, 19, 20)
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postedResult, setPostedResult] = useState<{
    receiptNo: string;
    amount: number;
    currency: string;
    journalNo: string;
    pdfUrl: string;
  } | null>(null);

  // Focus flow ref (Req 12)
  const bankSelectRef = useRef<HTMLSelectElement>(null);

  // Load active company and recent customers
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCompany = localStorage.getItem("aq_active_company");
      if (savedCompany) {
        try {
          const parsed = JSON.parse(savedCompany);
          setActiveCompany(parsed.company_name || parsed);
        } catch {
          setActiveCompany(savedCompany);
        }
      }

      const savedRecent = localStorage.getItem("aq_recent_customer_ids");
      if (savedRecent) {
        try {
          setRecentCustomerIds(JSON.parse(savedRecent));
        } catch {}
      }
    }
  }, []);

  // Fetch customers and accounts on open
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setPostError(null);
        const [custs, banks, agingRes] = await Promise.all([
          fetchApi<any[]>("/customers").catch(() => []),
          fetchApi<any[]>("/accounting/banks").catch(() => []),
          fetchApi<any>("/accounting/receivables/aging").catch(() => null),
        ]);

        const agingMap: { [id: number]: any } = {};
        if (agingRes?.customers) {
          agingRes.customers.forEach((c: any) => {
            agingMap[c.customer_id] = c;
          });
        }

        const enhancedCusts: CustomerOption[] = (custs || []).map((c: any) => {
          const aging = agingMap[c.id];
          return {
            id: c.id,
            customer_name: c.customer_name,
            outstanding_balance: aging?.total_outstanding || c.outstanding_balance || 0,
            open_invoices_count: aging?.open_invoices_count || (aging?.invoices?.length) || 0,
            invoices: aging?.invoices || [],
          };
        });

        setCustomers(enhancedCusts);
        setBankAccounts(banks || []);

        if (banks && banks.length > 0 && !selectedBankId) {
          setSelectedBankId(banks[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load customer receipt data", err);
        setPostError("Failed to load customer list. Check network connection.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Update open invoices when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      const invs = selectedCustomer.invoices || [];
      setOpenInvoices(invs);

      const parsedAmt = parseFloat(amountStr) || 0;
      if (parsedAmt > 0) {
        let remaining = parsedAmt;
        const newAlloc: { [id: number]: number } = {};
        for (const inv of invs) {
          const invBal = inv.balance ?? (inv.amount - (inv.received || 0));
          if (remaining <= 0) break;
          const alloc = Math.min(remaining, invBal);
          newAlloc[inv.invoice_id] = alloc;
          remaining -= alloc;
        }
        setManualAllocations(newAlloc);
      }
    }
  }, [selectedCustomer, amountStr]);

  // Filtered customers (recent first)
  const orderedCustomers = useMemo(() => {
    let list = [...customers];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.customer_name.toLowerCase().includes(q));
    } else {
      list.sort((a, b) => {
        const aIndex = recentCustomerIds.indexOf(a.id);
        const bIndex = recentCustomerIds.indexOf(b.id);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return (b.outstanding_balance || 0) - (a.outstanding_balance || 0);
      });
    }
    return list;
  }, [customers, searchQuery, recentCustomerIds]);

  const numAmount = parseFloat(amountStr) || 0;

  // Allocation progress calculations (Req 15)
  const totalAllocated = useMemo(() => {
    if (allocationMode === "OLDEST_FIRST") {
      let sum = 0;
      let rem = numAmount;
      for (const inv of openInvoices) {
        const invBal = inv.balance ?? (inv.amount - (inv.received || 0));
        const alloc = Math.min(rem, invBal);
        sum += alloc;
        rem -= alloc;
        if (rem <= 0) break;
      }
      return sum;
    }
    return Object.values(manualAllocations).reduce((a, b) => a + (b || 0), 0);
  }, [allocationMode, numAmount, openInvoices, manualAllocations]);

  const remainingUnallocated = Math.max(0, numAmount - totalAllocated);

  const handleSelectCustomer = (cust: CustomerOption) => {
    setSelectedCustomer(cust);
    if (typeof window !== "undefined") {
      const nextRecent = [cust.id, ...recentCustomerIds.filter((id) => id !== cust.id)].slice(0, 5);
      setRecentCustomerIds(nextRecent);
      localStorage.setItem("aq_recent_customer_ids", JSON.stringify(nextRecent));
    }
    setStep("ENTER_FORM");
  };

  // Execute Post to Backend (Req 18)
  const handleConfirmAndPost = async () => {
    if (!selectedCustomer || !selectedBankId || numAmount <= 0) {
      setPostError("Please select customer, receiving account, and a valid amount.");
      return;
    }

    try {
      setIsPosting(true);
      setPostError(null);

      const payload: any = {
        customer_id: selectedCustomer.id,
        bank_account_id: selectedBankId,
        date: receiptDate,
        amount: numAmount,
        currency,
        exchange_rate: 1.0,
        reference: reference || null,
        transaction_reference: reference || null,
        notes: [mt103Number ? `MT103: ${mt103Number}` : null, notes].filter(Boolean).join(" | ") || null,
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

      const receiptNumber = res.receipt_number || res.transaction_code || `CR-${Date.now().toString().slice(-6)}`;
      const journalNumber = res.journal_entry_number || res.journal_number || `JV-${Date.now().toString().slice(-6)}`;

      setPostedResult({
        receiptNo: receiptNumber,
        amount: numAmount,
        currency,
        journalNo: journalNumber,
        pdfUrl: res.pdf_url || `/api/v1/vouchers/RECEIPT/${res.id || 1}/pdf`,
      });

      setStep("POST_SUCCESS");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setPostError(err.message || "Failed to post transaction. Please verify network or ledger state.");
      setStep("POST_FAILURE");
    } finally {
      setIsPosting(false);
    }
  };

  const resetForm = () => {
    setStep("SELECT_CUSTOMER");
    setSelectedCustomer(null);
    setAmountStr("");
    setReference("");
    setMt103Number("");
    setNotes("");
    setManualAllocations({});
    setPostError(null);
    setPostedResult(null);
  };

  // iOS Web Share API (Req 19, 36)
  const handleShareReceipt = async () => {
    if (!postedResult) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${postedResult.receiptNo} — AQ Companies`,
          text: `Official Customer Payment Receipt ${postedResult.receiptNo} for ${formatCurrency(
            postedResult.amount,
            postedResult.currency
          )} has been verified and posted to the General Ledger.`,
          url: window.location.origin,
        });
      } catch (err) {
        console.warn("Share cancelled or failed", err);
      }
    } else {
      navigator.clipboard?.writeText(
        `Receipt: ${postedResult.receiptNo} | Amount: ${formatCurrency(
          postedResult.amount,
          postedResult.currency
        )} | Journal: ${postedResult.journalNo}`
      );
      alert("Receipt details copied to clipboard!");
    }
  };

  if (!isOpen) return null;

  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="w-full sm:max-w-lg bg-white dark:bg-[#111827] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] max-h-[94dvh] animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Customer Receipt
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span>{activeCompany}</span>
                <span>•</span>
                <span>
                  {step === "SELECT_CUSTOMER"
                    ? "Step 1/3 (Customer)"
                    : step === "ENTER_FORM"
                    ? "Step 2/3 (Receipt Details)"
                    : step === "ALLOCATE"
                    ? "Step 3/3 (Invoice Allocation)"
                    : step === "REVIEW"
                    ? "Review & Confirm"
                    : "Complete"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Operating Entity Banner */}
        <div className="px-4 py-2 bg-sky-500/10 border-b border-sky-500/20 text-sky-800 dark:text-sky-300 text-[11px] flex items-center justify-between font-semibold">
          <span className="flex items-center gap-1.5 truncate">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            Entity: {activeCompany}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-sky-600 font-bold shrink-0">
            LEDGER ISOLATED
          </span>
        </div>

        {/* Modal Body Container */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
          {/* ========================================================= */}
          {/* STEP 1: SELECT CUSTOMER                                  */}
          {/* ========================================================= */}
          {step === "SELECT_CUSTOMER" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="Search customer name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 h-11"
                />
              </div>

              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                {searchQuery ? "Matching Customers" : "Recent & Top Debtors"}
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {loading ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RotateCw className="w-4 h-4 animate-spin text-sky-500" />
                    Loading customer accounts...
                  </div>
                ) : orderedCustomers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No matching customers found.
                  </div>
                ) : (
                  orderedCustomers.map((cust) => {
                    const isRecent = recentCustomerIds.includes(cust.id);
                    return (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelectCustomer(cust)}
                        className="w-full text-left p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-500 dark:hover:border-emerald-500 active:scale-[0.98] transition-all flex items-center justify-between gap-3 shadow-2xs cursor-pointer min-h-[56px]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {cust.customer_name}
                            </span>
                            {isRecent && !searchQuery && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Recent
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                            <span>
                              Outstanding:{" "}
                              <strong className="text-rose-600 dark:text-rose-400 font-mono">
                                {formatUSD(cust.outstanding_balance || 0)}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>{cust.open_invoices_count || 0} Open Invoices</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: ENTER RECEIPT DETAILS (Exact Order per Req 10)     */}
          {/* 1. Customer, 2. Amount, 3. Receiving Account, 4. Currency */}
          {/* 5. Date, 6. Reference, 7. MT103, 8. Notes                */}
          {/* ========================================================= */}
          {step === "ENTER_FORM" && selectedCustomer && (
            <div className="space-y-3.5">
              {/* 1. Selected Customer Card */}
              <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/20 border border-sky-500/20 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-sky-600">Customer</div>
                  <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                    {selectedCustomer.customer_name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Balance: {formatUSD(selectedCustomer.outstanding_balance || 0)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("SELECT_CUSTOMER")}
                  className="text-xs font-semibold text-sky-600 dark:text-sky-400 underline shrink-0 p-1 min-h-[44px] flex items-center"
                >
                  Change
                </button>
              </div>

              {/* 2. Amount & 4. Currency (Large Amount Entry per Req 11) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Receipt Amount *
                </label>
                <div className="relative rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/20 p-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 pl-1">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.]?[0-9]*"
                      placeholder="0.00"
                      value={amountStr}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                          setAmountStr(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          bankSelectRef.current?.focus();
                        }
                      }}
                      className="w-full bg-transparent text-2xl font-black font-mono text-slate-900 dark:text-slate-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Currency Selector */}
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shrink-0"
                  >
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                    <option value="AFN">AFN</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>

              {/* 3. Receiving Account */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Receiving Account *
                </label>
                <select
                  ref={bankSelectRef}
                  value={selectedBankId || ""}
                  onChange={(e) => setSelectedBankId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px]"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} ({b.currency}) — {b.account_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Date & 6. Reference */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Bank Reference #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WIRE-84920"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px]"
                  />
                </div>
              </div>

              {/* 7. MT103 (SWIFT Confirmation) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  MT103 / Swift Tracking Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. MT103-2026-94819"
                  value={mt103Number}
                  onChange={(e) => setMt103Number(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[44px]"
                />
              </div>

              {/* 8. Notes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Accounting Notes / Remittance Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional ledger memo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Next Navigation */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep("SELECT_CUSTOMER")}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 min-h-[44px]"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={numAmount <= 0}
                  onClick={() => setStep("ALLOCATE")}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                >
                  <span>Proceed to Invoice Allocation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: INVOICE ALLOCATION & PROGRESS (Req 14, 15, 16)    */}
          {/* ========================================================= */}
          {step === "ALLOCATE" && selectedCustomer && (
            <div className="space-y-4">
              {/* Simple Visual Summary (Req 15) */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center font-mono">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Receipt</div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">
                    {formatCurrency(numAmount, currency)}
                  </div>
                </div>
                <div className="border-x border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                    Allocated
                  </div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(totalAllocated, currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                    Remaining
                  </div>
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {formatCurrency(remainingUnallocated, currency)}
                  </div>
                </div>
              </div>

              {/* Allocation Mode Selector */}
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAllocationMode("OLDEST_FIRST")}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition-all min-h-[36px] ${
                    allocationMode === "OLDEST_FIRST"
                      ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  Auto (Oldest Invoices)
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationMode("MANUAL")}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition-all min-h-[36px] ${
                    allocationMode === "MANUAL"
                      ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  Manual Allocation
                </button>
              </div>

              {/* Invoice Allocation Cards (Exact format per Req 14) */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Open Invoices ({openInvoices.length})
                </div>

                {openInvoices.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 text-center text-xs text-slate-400">
                    No open invoices. Unallocated amount posts to Balance Sheet as a customer advance.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[32vh] overflow-y-auto pr-1">
                    {openInvoices.map((inv) => {
                      const invAmount = inv.amount || 0;
                      const receivedAmount = inv.received || 0;
                      const invBal = inv.balance ?? invAmount - receivedAmount;
                      const allocatedVal =
                        allocationMode === "MANUAL"
                          ? manualAllocations[inv.invoice_id] || 0
                          : Math.min(
                              numAmount,
                              invBal
                            );

                      return (
                        <div
                          key={inv.invoice_id}
                          className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                              {inv.invoice_number}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {inv.date || "13 Aug 2026"}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1 text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <div>
                              <span className="text-[9px] uppercase block text-slate-400">Invoice</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatUSD(invAmount)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase block text-slate-400">Received</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatUSD(receivedAmount)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase block text-slate-400">Balance</span>
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                {formatUSD(invBal)}
                              </span>
                            </div>
                          </div>

                          {/* Allocate Row */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              Allocate:
                            </span>
                            {allocationMode === "MANUAL" ? (
                              <div className="w-32">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={invBal}
                                  value={manualAllocations[inv.invoice_id] || ""}
                                  placeholder="0.00"
                                  onChange={(e) =>
                                    setManualAllocations({
                                      ...manualAllocations,
                                      [inv.invoice_id]: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full px-2.5 py-1 text-right text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-9"
                                />
                              </div>
                            ) : (
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {formatUSD(allocatedVal)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sticky Post Action Bar (Req 16: [ Save Draft ] [ Review & Post ]) */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(
                      `aq_draft_receipt_${selectedCustomer.id}`,
                      JSON.stringify({ amount: numAmount, date: receiptDate, reference })
                    );
                    alert("Draft saved safely to local device.");
                  }}
                  className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 min-h-[44px]"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={() => setStep("REVIEW")}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                >
                  <span>Review & Post</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: REVIEW SCREEN (Exact layout per Req 17)           */}
          {/* ========================================================= */}
          {step === "REVIEW" && selectedCustomer && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-3 text-xs">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-800">
                  CUSTOMER RECEIPT REVIEW
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Customer</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-right">
                    {selectedCustomer.customer_name}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-mono font-black text-base text-slate-900 dark:text-slate-100">
                    {formatCurrency(numAmount, currency)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Receiving Account</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                    {selectedBank?.bank_name} ({currency})
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800 font-mono">
                  <span className="text-slate-500">Allocated to Invoices</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(totalAllocated, currency)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800 font-mono">
                  <span className="text-slate-500">Remaining (Advance)</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(remainingUnallocated, currency)}
                  </span>
                </div>

                {/* Accounting Preview per Req 17 */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1 font-mono text-[11px]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">
                    Expected Double-Entry Posting:
                  </div>
                  <div className="text-sky-600 dark:text-sky-400 font-bold">
                    DR 1010 Bank / Cash Account: +{formatCurrency(numAmount, currency)}
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                    CR 1100 Accounts Receivable: -{formatCurrency(totalAllocated, currency)}
                  </div>
                  {remainingUnallocated > 0 && (
                    <div className="text-amber-600 dark:text-amber-400 font-bold">
                      CR 2200 Customer Advance: -{formatCurrency(remainingUnallocated, currency)}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: [ Back ] [ Confirm & Post ] */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isPosting}
                  onClick={() => setStep("ALLOCATE")}
                  className="py-3 px-5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 min-h-[44px]"
                >
                  Back
                </button>

                <button
                  type="button"
                  disabled={isPosting}
                  onClick={handleConfirmAndPost}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                >
                  {isPosting ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Posting transaction...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Confirm & Post</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 5: POST SUCCESS SCREEN (Exact layout per Req 19)     */}
          {/* ========================================================= */}
          {step === "POST_SUCCESS" && postedResult && (
            <div className="text-center space-y-4 py-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  ✓ RECEIPT POSTED
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Committed to Double-Entry General Ledger
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2 text-xs font-mono text-left">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Receipt No:</span>
                  <QuickCopy text={postedResult.receiptNo} />
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Amount:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(postedResult.amount, postedResult.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Journal:</span>
                  <QuickCopy text={postedResult.journalNo} />
                </div>
              </div>

              {/* Actions: View Receipt, Download PDF, Share, View Journal, Done */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleShareReceipt}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition-all min-h-[44px] cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Receipt (WhatsApp / AirDrop)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={postedResult.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 min-h-[44px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </a>

                  <a
                    href={`/accounting/general-ledger?search=${encodeURIComponent(postedResult.journalNo)}`}
                    className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 min-h-[44px]"
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-600" />
                    <span>View Journal</span>
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 min-h-[44px]"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 6: POST FAILURE SCREEN (Exact layout per Req 20)     */}
          {/* ========================================================= */}
          {step === "POST_FAILURE" && (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center shadow-inner">
                <AlertCircle className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div>
                <h3 className="text-base font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  TRANSACTION NOT POSTED
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  {postError || "An error occurred while communicating with the accounting engine."}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Your entered data has been preserved.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("REVIEW")}
                  className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/25 active:scale-95 transition-all min-h-[44px] cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 inline mr-1" />
                  Try Again
                </button>

                <button
                  type="button"
                  onClick={() => setStep("ENTER_FORM")}
                  className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs min-h-[44px]"
                >
                  Edit Details
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
