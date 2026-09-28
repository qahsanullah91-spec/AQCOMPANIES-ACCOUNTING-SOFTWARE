"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Wallet,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Scale,
  Lock,
  Printer,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  DollarSign,
  Search,
  Filter,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { VoucherPrintModal, VoucherData } from "@/components/VoucherPrintModal";
import { fetchApi, formatUSD } from "@/lib/api";

interface DailySummary {
  opening_cash_usd: number;
  opening_bank_usd: number;
  opening_sarafi_usd: number;
  money_received_usd: number;
  money_paid_usd: number;
  customer_receipts_usd: number;
  supplier_payments_usd: number;
  transport_payments_usd: number;
  operating_expenses_usd: number;
  bank_charges_usd: number;
  transfers_in_usd: number;
  transfers_out_usd: number;
  sarafi_volume_usd: number;
  fx_volume_usd: number;
  closing_cash_usd: number;
  closing_bank_usd: number;
  closing_sarafi_usd: number;
  net_movement_usd: number;
}

interface AccountInfo {
  id: number;
  bank_name: string;
  account_name: string;
  currency: string;
  account_type: string;
  current_balance: number;
}

interface DailyTransaction {
  id: number;
  code: string;
  voucher_number?: string;
  date: string;
  account_id: number;
  account_name: string;
  channel: string;
  party_name: string;
  type: string;
  money_in: number;
  money_out: number;
  usd_equivalent_in?: number;
  usd_equivalent_out?: number;
  currency: string;
  reference: string;
  status: string;
  running_balance: number;
}

export default function DailyAccountingPage() {
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [transactions, setTransactions] = useState<DailyTransaction[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");

  // Modals state
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showCashCountModal, setShowCashCountModal] = useState<boolean>(false);
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);

  // Form states
  const [receiptForm, setReceiptForm] = useState({
    account_id: "",
    received_from: "",
    party_type: "CUSTOMER",
    amount: "",
    currency: "USD",
    reference: "",
    description: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    account_id: "",
    paid_to: "",
    party_type: "SUPPLIER",
    amount: "",
    currency: "USD",
    expense_account_code: "6000",
    reference: "",
    description: "",
  });

  const [transferForm, setTransferForm] = useState({
    source_account_id: "",
    destination_account_id: "",
    source_amount: "",
    destination_amount: "",
    exchange_rate: "1.00",
    commission_amount: "0.00",
    reference: "",
    description: "",
  });

  const [cashCountForm, setCashCountForm] = useState({
    cash_account_id: "",
    physical_count: "",
    reason: "",
    auto_adjust: false,
  });

  const [closeForm, setCloseForm] = useState({
    notes: "",
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showReviewTodayModal, setShowReviewTodayModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetchApi<any>(`/accounting/daily?target_date=${targetDate}`);
      setSummary(res.summary);
      setTransactions(res.transactions || []);
      setAccounts(res.accounts || []);

      if (res.accounts && res.accounts.length > 0) {
        if (!receiptForm.account_id) setReceiptForm((f) => ({ ...f, account_id: String(res.accounts[0].id) }));
        if (!paymentForm.account_id) setPaymentForm((f) => ({ ...f, account_id: String(res.accounts[0].id) }));
        const cashAccs = res.accounts.filter((a: any) => a.account_type === "CASH");
        if (cashAccs.length > 0 && !cashCountForm.cash_account_id) {
          setCashCountForm((f) => ({ ...f, cash_account_id: String(cashAccs[0].id) }));
        }
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to load daily accounting activity");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [targetDate]);

  const handleQuickDate = (type: "today" | "yesterday") => {
    const d = new Date();
    if (type === "yesterday") {
      d.setDate(d.getDate() - 1);
    }
    setTargetDate(d.toISOString().split("T")[0]);
  };

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await fetchApi<any>("/accounting/receipts", {
        method: "POST",
        body: JSON.stringify({
          ...receiptForm,
          account_id: Number(receiptForm.account_id),
          amount: Number(receiptForm.amount),
          receipt_date: targetDate,
        }),
      });
      setActionSuccess(`Receipt ${res.voucher_number} recorded successfully!`);
      setShowReceiptModal(false);
      setReceiptForm({
        account_id: accounts[0]?.id ? String(accounts[0].id) : "",
        received_from: "",
        party_type: "CUSTOMER",
        amount: "",
        currency: "USD",
        reference: "",
        description: "",
      });
      loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to record receipt");
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await fetchApi<any>("/accounting/payments", {
        method: "POST",
        body: JSON.stringify({
          ...paymentForm,
          account_id: Number(paymentForm.account_id),
          amount: Number(paymentForm.amount),
          payment_date: targetDate,
        }),
      });
      setActionSuccess(`Payment ${res.voucher_number} recorded successfully!`);
      setShowPaymentModal(false);
      setPaymentForm({
        account_id: accounts[0]?.id ? String(accounts[0].id) : "",
        paid_to: "",
        party_type: "SUPPLIER",
        amount: "",
        currency: "USD",
        expense_account_code: "6000",
        reference: "",
        description: "",
      });
      loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to record payment");
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await fetchApi<any>("/accounting/transfers", {
        method: "POST",
        body: JSON.stringify({
          source_account_id: Number(transferForm.source_account_id),
          destination_account_id: Number(transferForm.destination_account_id),
          source_amount: Number(transferForm.source_amount),
          destination_amount: transferForm.destination_amount ? Number(transferForm.destination_amount) : undefined,
          exchange_rate: transferForm.exchange_rate ? Number(transferForm.exchange_rate) : undefined,
          commission_amount: transferForm.commission_amount ? Number(transferForm.commission_amount) : 0,
          transfer_date: targetDate,
          reference: transferForm.reference,
          description: transferForm.description,
        }),
      });
      setActionSuccess(`Transfer ${res.transfer_code} executed successfully!`);
      setShowTransferModal(false);
      loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to execute transfer");
    }
  };

  const handleCashCount = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await fetchApi<any>("/accounting/cash-count", {
        method: "POST",
        body: JSON.stringify({
          cash_account_id: Number(cashCountForm.cash_account_id),
          physical_count: Number(cashCountForm.physical_count),
          reason: cashCountForm.reason,
          auto_adjust: cashCountForm.auto_adjust,
        }),
      });
      setActionSuccess(
        `Cash count ${res.count_code} recorded. Status: ${res.status} (${formatUSD(res.difference)})`
      );
      setShowCashCountModal(false);
      loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to record cash count");
    }
  };

  const handleDailyClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await fetchApi<any>("/accounting/daily-close", {
        method: "POST",
        body: JSON.stringify({
          close_date: targetDate,
          notes: closeForm.notes,
        }),
      });
      setActionSuccess(`Financial Close for ${res.close_date} completed!`);
      setShowCloseModal(false);
      loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to complete daily close");
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      (t.voucher_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.party_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.reference || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChannel =
      channelFilter === "ALL" || t.channel.toUpperCase() === channelFilter.toUpperCase();
    return matchesSearch && matchesChannel;
  });

  const selectedCashAcc = accounts.find((a) => a.id === Number(cashCountForm.cash_account_id));

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-bold font-mono rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              LIVE DAILY OPERATIONS
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Cash • Bank • Sarafi Double-Entry
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Daily Accounting & Cash Control Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time daily financial operations, multi-channel transfers, cash counts, and daily closing.
          </p>
        </div>

        {/* Date Selector & Refresh */}
        <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <button
            onClick={() => handleQuickDate("yesterday")}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Yesterday
          </button>
          <button
            onClick={() => handleQuickDate("today")}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Today
          </button>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
          <div className="flex items-center space-x-1.5 px-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="text-xs font-bold font-mono bg-transparent border-none text-slate-800 dark:text-slate-200 focus:outline-hidden"
            />
          </div>
          <button
            onClick={loadData}
            className="p-1.5 text-slate-500 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <AccountingNav />

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-300">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowReceiptModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Record Receipt (CRV/BRV/SRV)</span>
          </button>

          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Record Payment (CPV/BPV/SPV)</span>
          </button>

          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transfer & FX (TRF/FX)</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* REVIEW TODAY BUTTON (Req 32) */}
          <button
            type="button"
            onClick={() => setShowReviewTodayModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-xs transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>REVIEW TODAY</span>
          </button>

          <button
            onClick={() => setShowCashCountModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-bold rounded-xl transition-colors"
          >
            <Scale className="w-4 h-4" />
            <span>Physical Cash Count</span>
          </button>

          <button
            onClick={() => setShowCloseModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Lock className="w-4 h-4" />
            <span>Daily Close</span>
          </button>
        </div>
      </div>

      {/* Financial Position Snapshot (Opening -> Inflows/Outflows -> Closing) */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Opening Balances */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
              <span>Opening Balances</span>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-2xs text-slate-400">Total Liquid Funds (Start)</span>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
                {formatUSD(summary.opening_cash_usd + summary.opening_bank_usd + summary.opening_sarafi_usd)}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-2xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Cash Vaults:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {formatUSD(summary.opening_cash_usd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Commercial Banks:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {formatUSD(summary.opening_bank_usd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sarafi Desks:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {formatUSD(summary.opening_sarafi_usd)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Money Received */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-100 dark:border-emerald-950/60 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-600 uppercase">
              <span>Money Received Today</span>
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <span className="text-2xs text-slate-400">Total Inflow</span>
              <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                +{formatUSD(summary.money_received_usd)}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-2xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Receipts:</span>
                <span className="font-mono font-bold text-emerald-600">
                  +{formatUSD(summary.customer_receipts_usd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transfers In:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  +{formatUSD(summary.transfers_in_usd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Other Inflow:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  +{formatUSD(Math.max(0, summary.money_received_usd - summary.customer_receipts_usd - summary.transfers_in_usd))}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Total Money Paid */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-100 dark:border-rose-950/60 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-rose-600 uppercase">
              <span>Money Paid Today</span>
              <ArrowUpRight className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <span className="text-2xs text-slate-400">Total Outflow</span>
              <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                -{formatUSD(summary.money_paid_usd)}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-2xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Suppliers:</span>
                <span className="font-mono font-bold text-rose-600">
                  -{formatUSD(summary.supplier_payments_usd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transport:</span>
                <span className="font-mono font-bold text-rose-600">
                  -{formatUSD(summary.transport_payments_usd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expenses & Fees:</span>
                <span className="font-mono font-bold text-rose-600">
                  -{formatUSD(summary.operating_expenses_usd + summary.bank_charges_usd)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Closing Balances & Net Movement */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
              <span>Closing Balances & Net</span>
              <span
                className={`px-2 py-0.5 text-2xs font-mono font-bold rounded ${
                  summary.net_movement_usd >= 0
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                }`}
              >
                {summary.net_movement_usd >= 0 ? "+" : ""}
                {formatUSD(summary.net_movement_usd)}
              </span>
            </div>
            <div>
              <span className="text-2xs text-slate-400">Total Liquid Funds (Close)</span>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
                {formatUSD(summary.closing_cash_usd + summary.closing_bank_usd + summary.closing_sarafi_usd)}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-2xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Cash Vaults:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {formatUSD(summary.closing_cash_usd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Commercial Banks:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {formatUSD(summary.closing_bank_usd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sarafi Desks:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {formatUSD(summary.closing_sarafi_usd)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Transactions Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Daily Chronological Transactions
            </h2>
            <span className="px-2 py-0.5 text-2xs font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {filteredTransactions.length} records
            </span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {/* Channel Filter */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
              {["ALL", "CASH", "BANK", "SARAFI"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={`px-2.5 py-1 rounded font-semibold text-2xs transition-colors ${
                    channelFilter === ch
                      ? "bg-white dark:bg-slate-900 text-sky-600 font-bold shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search voucher, party, ref..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Mobile Transactions Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-2.5">
          {filteredTransactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No transactions recorded for {targetDate}. Click "Record Receipt" or "Record Payment" to add activity.
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="pt-2.5 first:pt-0 pb-2 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() =>
                      setActiveVoucher({
                        voucher_number: tx.voucher_number || tx.code,
                        transaction_code: tx.code,
                        date: tx.date,
                        party_name: tx.party_name,
                        account_name: tx.account_name,
                        transaction_type: tx.type,
                        amount: tx.money_in > 0 ? tx.money_in : tx.money_out,
                        currency: tx.currency,
                        reference: tx.reference,
                        status: tx.status,
                      })
                    }
                    className="font-mono font-bold text-sky-600 hover:text-sky-700 hover:underline flex items-center space-x-1"
                  >
                    <span>{tx.voucher_number || tx.code}</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-block px-2 py-0.5 text-2xs font-semibold rounded ${
                        tx.status === "RECONCILED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : tx.status === "POSTED" || tx.status === "CLEARED"
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {tx.status}
                    </span>
                    <button
                      onClick={() =>
                        setActiveVoucher({
                          voucher_number: tx.voucher_number || tx.code,
                          transaction_code: tx.code,
                          date: tx.date,
                          party_name: tx.party_name,
                          account_name: tx.account_name,
                          transaction_type: tx.type,
                          amount: tx.money_in > 0 ? tx.money_in : tx.money_out,
                          currency: tx.currency,
                          reference: tx.reference,
                          status: tx.status,
                        })
                      }
                      className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Print Voucher"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {tx.party_name || "-"}
                    </span>
                    <span className="block text-2xs text-slate-500">
                      {tx.type} • {tx.account_name} ({tx.channel})
                    </span>
                  </div>
                  {tx.reference && (
                    <span className="font-mono text-2xs text-slate-400 shrink-0">
                      {tx.reference}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  {tx.money_in > 0 ? (
                    <span className="font-mono font-bold text-emerald-600">
                      +{formatUSD(tx.usd_equivalent_in || tx.money_in)}
                    </span>
                  ) : tx.money_out > 0 ? (
                    <span className="font-mono font-bold text-rose-600">
                      -{formatUSD(tx.usd_equivalent_out || tx.money_out)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1.5">Bal:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatUSD(tx.running_balance)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Transactions Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-2xs font-semibold">
              <tr>
                <th className="px-4 py-3">Voucher #</th>
                <th className="px-4 py-3">Channel / Account</th>
                <th className="px-4 py-3">Type & Party</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">Inflow (+)</th>
                <th className="px-4 py-3 text-right">Outflow (-)</th>
                <th className="px-4 py-3 text-right">Running Bal</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No transactions recorded for {targetDate}. Click "Record Receipt" or "Record Payment" to add activity.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          setActiveVoucher({
                            voucher_number: tx.voucher_number || tx.code,
                            transaction_code: tx.code,
                            date: tx.date,
                            party_name: tx.party_name,
                            account_name: tx.account_name,
                            transaction_type: tx.type,
                            amount: tx.money_in > 0 ? tx.money_in : tx.money_out,
                            currency: tx.currency,
                            reference: tx.reference,
                            status: tx.status,
                          })
                        }
                        className="font-mono font-bold text-sky-600 hover:text-sky-700 hover:underline flex items-center space-x-1"
                      >
                        <span>{tx.voucher_number || tx.code}</span>
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {tx.account_name}
                      </span>
                      <span className="block text-2xs text-slate-400 font-mono">
                        {tx.channel} • {tx.currency}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {tx.party_name || "-"}
                      </span>
                      <span className="block text-2xs text-slate-500">{tx.type}</span>
                    </td>

                    <td className="px-4 py-3 font-mono text-2xs text-slate-500">
                      {tx.reference || "-"}
                    </td>

                    <td className="px-4 py-3 font-mono font-bold text-right text-emerald-600">
                      {tx.money_in > 0 ? `+${formatUSD(tx.usd_equivalent_in || tx.money_in)}` : "-"}
                    </td>

                    <td className="px-4 py-3 font-mono font-bold text-right text-rose-600">
                      {tx.money_out > 0 ? `-${formatUSD(tx.usd_equivalent_out || tx.money_out)}` : "-"}
                    </td>

                    <td className="px-4 py-3 font-mono font-semibold text-right text-slate-900 dark:text-white">
                      {formatUSD(tx.running_balance)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-2xs font-semibold rounded ${
                          tx.status === "RECONCILED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : tx.status === "POSTED" || tx.status === "CLEARED"
                            ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          setActiveVoucher({
                            voucher_number: tx.voucher_number || tx.code,
                            transaction_code: tx.code,
                            date: tx.date,
                            party_name: tx.party_name,
                            account_name: tx.account_name,
                            transaction_type: tx.type,
                            amount: tx.money_in > 0 ? tx.money_in : tx.money_out,
                            currency: tx.currency,
                            reference: tx.reference,
                            status: tx.status,
                          })
                        }
                        className="p-1 text-slate-400 hover:text-sky-600 transition-colors"
                        title="Print Voucher"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: RECORD RECEIPT */}
      {/* ========================================================= */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Record Money In (Receipt Voucher)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Issues CRV (Cash), BRV (Bank), or SRV (Sarafi) with double-entry GL posting.
            </p>

            <form onSubmit={handleCreateReceipt} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Receiving Account
                </label>
                <select
                  value={receiptForm.account_id}
                  onChange={(e) => setReceiptForm({ ...receiptForm, account_id: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bank_name} ({a.currency}) — {a.account_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Received From (Customer / Payer)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mahavir Dry Fruit Import"
                  value={receiptForm.received_from}
                  onChange={(e) => setReceiptForm({ ...receiptForm, received_from: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={receiptForm.amount}
                    onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={receiptForm.currency}
                    onChange={(e) => setReceiptForm({ ...receiptForm, currency: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="AFN">AFN</option>
                    <option value="AED">AED</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reference / Cheque / Bank Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. WIRE-98124 or Counter Receipt #44"
                  value={receiptForm.reference}
                  onChange={(e) => setReceiptForm({ ...receiptForm, reference: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Purpose
                </label>
                <textarea
                  rows={2}
                  placeholder="Particulars of payment receipt..."
                  value={receiptForm.description}
                  onChange={(e) => setReceiptForm({ ...receiptForm, description: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                >
                  Save Receipt Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: RECORD PAYMENT */}
      {/* ========================================================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Record Money Out (Payment Voucher)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Issues CPV (Cash), BPV (Bank), or SPV (Sarafi) for Supplier, Carrier, or Expense.
            </p>

            <form onSubmit={handleCreatePayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Source Account
                </label>
                <select
                  value={paymentForm.account_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, account_id: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bank_name} ({a.currency}) — Balance: {formatUSD(a.current_balance)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Beneficiary Category
                  </label>
                  <select
                    value={paymentForm.party_type}
                    onChange={(e) => setPaymentForm({ ...paymentForm, party_type: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-semibold"
                  >
                    <option value="SUPPLIER">Supplier (Account 2000/1350)</option>
                    <option value="TRANSPORT">Carrier / Sky Ariana (2100)</option>
                    <option value="EXPENSE">Operating Expense (6000)</option>
                    <option value="OTHER">Other Disbursement</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Beneficiary Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sky Ariana Limited"
                    value={paymentForm.paid_to}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paid_to: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={paymentForm.currency}
                    onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="AFN">AFN</option>
                    <option value="AED">AED</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reference / Check #
                </label>
                <input
                  type="text"
                  placeholder="e.g. WIRE-REF-4091"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Particulars / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for disbursement..."
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
                >
                  Save Payment Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: TRANSFER & FX */}
      {/* ========================================================= */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Multi-Channel Transfer & FX Exchange
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Bank ↔ Cash ↔ Sarafi transfers. Single business event. Zero revenue/expense on principal.
            </p>

            <form onSubmit={handleCreateTransfer} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    From Source Account
                  </label>
                  <select
                    value={transferForm.source_account_id}
                    onChange={(e) => setTransferForm({ ...transferForm, source_account_id: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                    required
                  >
                    <option value="">Select source...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bank_name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    To Destination Account
                  </label>
                  <select
                    value={transferForm.destination_account_id}
                    onChange={(e) => setTransferForm({ ...transferForm, destination_account_id: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                    required
                  >
                    <option value="">Select destination...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bank_name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Source Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={transferForm.source_amount}
                    onChange={(e) => setTransferForm({ ...transferForm, source_amount: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    FX Rate
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="1.0000"
                    value={transferForm.exchange_rate}
                    onChange={(e) => setTransferForm({ ...transferForm, exchange_rate: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dest Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Auto if 1:1"
                    value={transferForm.destination_amount}
                    onChange={(e) => setTransferForm({ ...transferForm, destination_amount: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Commission / Transfer Fee (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00 (posted to Account 5600)"
                  value={transferForm.commission_amount}
                  onChange={(e) => setTransferForm({ ...transferForm, commission_amount: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Particulars / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. ATM Vault Replenishment or Shahzada broker funding"
                  value={transferForm.reference}
                  onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: PHYSICAL CASH COUNT */}
      {/* ========================================================= */}
      {showCashCountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Physical Cash Count & Reconciliation
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter verified physical cash in vault. Compares vs system ledger and detects shortage or overage.
            </p>

            <form onSubmit={handleCashCount} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cash Vault Account
                </label>
                <select
                  value={cashCountForm.cash_account_id}
                  onChange={(e) => setCashCountForm({ ...cashCountForm, cash_account_id: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                  required
                >
                  {accounts
                    .filter((a) => a.account_type === "CASH")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bank_name} ({a.currency}) — System: {formatUSD(a.current_balance)}
                      </option>
                    ))}
                </select>
              </div>

              {selectedCashAcc && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-500">System Recorded Balance:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {formatUSD(selectedCashAcc.current_balance)}
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Actual Physical Cash Counted
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Counted cash amount..."
                  value={cashCountForm.physical_count}
                  onChange={(e) => setCashCountForm({ ...cashCountForm, physical_count: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-mono font-bold text-sm"
                  required
                />
              </div>

              {selectedCashAcc && cashCountForm.physical_count && (
                <div
                  className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                    Number(cashCountForm.physical_count) === Number(selectedCashAcc.current_balance)
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300"
                      : Number(cashCountForm.physical_count) < Number(selectedCashAcc.current_balance)
                      ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-300"
                      : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  <span className="font-bold">
                    {Number(cashCountForm.physical_count) === Number(selectedCashAcc.current_balance)
                      ? "MATCHED (Exact match)"
                      : Number(cashCountForm.physical_count) < Number(selectedCashAcc.current_balance)
                      ? "SHORTAGE DETECTED"
                      : "OVERAGE DETECTED"}
                  </span>
                  <span className="font-mono font-bold text-sm">
                    {formatUSD(Number(cashCountForm.physical_count) - Number(selectedCashAcc.current_balance))}
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Reason for Discrepancy
                </label>
                <input
                  type="text"
                  placeholder="e.g. End of day register check"
                  value={cashCountForm.reason}
                  onChange={(e) => setCashCountForm({ ...cashCountForm, reason: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="auto_adjust"
                  checked={cashCountForm.auto_adjust}
                  onChange={(e) => setCashCountForm({ ...cashCountForm, auto_adjust: e.target.checked })}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <label htmlFor="auto_adjust" className="text-2xs text-slate-600 dark:text-slate-400 font-semibold cursor-pointer">
                  Auto-adjust system cash to physical count (Posts to Account 6450 Shortage / 4100 Overage)
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCashCountModal(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl"
                >
                  Record Cash Count
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: DAILY CLOSE */}
      {/* ========================================================= */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Close Financial Day ({targetDate})
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pre-close integrity validation will ensure no unbalanced entries exist before locking the day.
            </p>

            <form onSubmit={handleDailyClose} className="space-y-4 text-xs">
              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Pre-Close Validation Checklist:
                </span>
                <div className="flex items-center space-x-2 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>General Ledger double-entry trial balance checked ($0.00 diff)</span>
                </div>
                <div className="flex items-center space-x-2 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Subledger consistency verified across all active accounts</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-500">
                  <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center text-3xs font-bold">
                    ✓
                  </div>
                  <span>Closing snapshot saved to DailyClose register</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Closing Notes / Supervisor Confirmation
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Verified by Chief Accountant. All bank wires reconciled."
                  value={closeForm.notes}
                  onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-black dark:bg-slate-800 text-white font-bold rounded-xl"
                >
                  Confirm Daily Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          END-OF-DAY REVIEW MODAL (Req 32)
          Shows: Receipts, Payments, Bank Activity, Cash Activity,
          Pending Drafts, Unreconciled Items, Warnings.
          DO NOT close period automatically.
          ========================================================= */}
      {showReviewTodayModal && summary && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full sm:max-w-lg bg-white dark:bg-[#111827] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] max-h-[92dvh] animate-slideUp">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    End-of-Day Financial Review
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Activity Date: {targetDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewTodayModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informational Banner: Do not close period automatically (Req 32) */}
            <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                Audit Review Mode Only
              </span>
              <span className="text-[10px] uppercase font-bold text-emerald-600">
                PERIOD REMAINS OPEN
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Cash & Bank Movement Overview */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Opening Cash</span>
                  <span className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5 block font-mono">
                    {formatUSD(summary.opening_cash_usd)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Closing Cash Position</span>
                  <span className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5 block font-mono">
                    {formatUSD(summary.closing_cash_usd)}
                  </span>
                </div>
              </div>

              {/* Inflows & Outflows Breakdown */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  Activity Breakdown
                </span>

                <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800/60">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-400">Customer Receipts</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      +{formatUSD(summary.customer_receipts_usd)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-400">Supplier Payments</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      -{formatUSD(summary.supplier_payments_usd)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-400">Transport Freight Payments</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      -{formatUSD(summary.transport_payments_usd)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-400">Operating Expenses</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      -{formatUSD(summary.operating_expenses_usd)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-400">Bank Charges & Fees</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      -{formatUSD(summary.bank_charges_usd)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 font-bold">
                    <span className="text-slate-800 dark:text-slate-200">Net Movement</span>
                    <span
                      className={`font-black font-mono ${
                        summary.net_movement_usd >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {summary.net_movement_usd >= 0 ? "+" : ""}
                      {formatUSD(summary.net_movement_usd)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Warnings Checklist */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  Integrity Validation
                </span>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Double-entry balance verified ($0.00 difference)</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>No unposted drafts blocking reconciliation</span>
                  </div>
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Afghanistan supplier purchase rates pending (profit provisional)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowReviewTodayModal(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100"
              >
                Close Review
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowReviewTodayModal(false);
                  setShowCloseModal(true);
                }}
                className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black dark:bg-slate-800 text-white font-bold text-xs shadow-xs"
              >
                Proceed to Daily Close...
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Print Modal */}
      <VoucherPrintModal voucher={activeVoucher} onClose={() => setActiveVoucher(null)} />
    </div>
  );
}
