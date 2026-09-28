"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Printer,
  Calendar,
  DollarSign,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";
import {
  PdfDownloadButton,
  PrintButton,
  MoneyDisplay,
} from "@/components/accounting";

export default function CashFlowStatementPage() {
  const [data, setData] = useState<any>(null);
  const [periodType, setPeriodType] = useState<string>("monthly");
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inflowExpanded, setInflowExpanded] = useState(true);
  const [outflowExpanded, setOutflowExpanded] = useState(true);

  const loadData = async (type: string, dateVal: string) => {
    try {
      setLoading(true);
      const [cfRes, txRes] = await Promise.all([
        fetchApi<any>(`/accounting/cash-flow?period_type=${type}&as_of_date=${dateVal}`),
        fetchApi<any[]>("/accounting/bank-transactions"),
      ]);
      setData(cfRes);
      setTransactions(Array.isArray(txRes) ? txRes : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(periodType, asOfDate);
  }, []);

  const handlePeriodChange = (newType: string) => {
    setPeriodType(newType);
    loadData(newType, asOfDate);
  };

  const handleDateChange = (newDate: string) => {
    setAsOfDate(newDate);
    loadData(periodType, newDate);
  };

  const openingCash = data?.opening_cash || 0;
  const moneyIn = data?.money_in || { customer_receipts: 0, other_income: 0, total_in: 0 };
  const moneyOut = data?.money_out || {
    supplier_payments: 0,
    transport_payments: 0,
    expenses: 0,
    bank_charges: 0,
    total_out: 0,
  };
  const netFlow = data?.net_cash_flow || 0;
  const closingCash = data?.closing_cash || 0;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ArrowUpDown className="w-7 h-7 text-sky-600" />
            Cash Flow Statement
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Multi-Bank Liquidity, Wire Inflows & Operational Disbursements
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs">
            <label className="font-semibold text-slate-600 dark:text-slate-300">As of:</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="input py-1 text-xs"
            />
          </div>
          <PdfDownloadButton
            url={`/api/v1/accounting/cash-flow.pdf?as_of_date=${asOfDate}`}
            filename={`AQ-Cash-Flow-${asOfDate}.pdf`}
            label="Download PDF"
            size="sm"
          />
          <PrintButton label="Print" size="sm" />
        </div>
      </div>

      <div className="hidden md:block">
        <AccountingNav />
      </div>

      {/* Period Selection Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">View Aggregation:</span>
          {["daily", "weekly", "monthly", "yearly"].map((t) => (
            <button
              key={t}
              onClick={() => handlePeriodChange(t)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors min-h-[32px] ${
                periodType === t
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Currency: <strong className="text-slate-800 dark:text-slate-200">USD</strong> (Standardized)
        </div>
      </div>

      {/* High-Level Liquidity Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Opening Cash */}
        <div className="card p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Opening Cash</span>
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
            {formatUSD(openingCash)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Initial Bank Reserves</p>
        </div>

        {/* Money In */}
        <div className="card p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Money In (Inflow)</span>
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            +{formatUSD(moneyIn.total_in)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Customer Collections</p>
        </div>

        {/* Money Out */}
        <div className="card p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Money Out (Outflow)</span>
            <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
            -{formatUSD(moneyOut.total_out)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Carrier & Supplier Wires</p>
        </div>

        {/* Closing Cash */}
        <div className="card p-3.5 sm:p-4 bg-sky-50/40 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Closing Cash</span>
            <Landmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600" />
          </div>
          <div className={`text-lg sm:text-2xl font-black font-mono ${closingCash >= 0 ? "text-sky-600 dark:text-sky-400" : "text-rose-600 dark:text-rose-400"}`}>
            {formatUSD(closingCash)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            Net: {netFlow >= 0 ? "+" : ""}{formatUSD(netFlow)}
          </p>
        </div>
      </div>

      {/* Cash Flow Statement Breakdown */}
      <div className="card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Statement of Cash Inflows & Outflows
          </h2>
          <span className="text-[10px] sm:text-xs text-slate-500 font-mono">
            Standard Direct Method
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {/* Opening Balance */}
          <div className="p-4 bg-slate-50/30 dark:bg-slate-800/10 flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
            <span>OPENING CASH & CASH EQUIVALENTS</span>
            <span className="font-mono text-sm">{formatUSD(openingCash)}</span>
          </div>

          {/* Cash Inflows (Expandable) */}
          <div className="p-4 sm:p-6 space-y-3">
            <button
              type="button"
              onClick={() => setInflowExpanded(!inflowExpanded)}
              className="w-full flex items-center justify-between text-slate-900 dark:text-slate-100 font-black text-xs uppercase tracking-wide border-b border-slate-200 dark:border-slate-800 pb-2 text-left"
            >
              <div className="flex items-center space-x-2">
                {inflowExpanded ? (
                  <ChevronDown className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-emerald-700 dark:text-emerald-400">Cash Inflows (Money In)</span>
              </div>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                +{formatUSD(moneyIn.total_in)}
              </span>
            </button>

            {inflowExpanded && (
              <div className="space-y-2 pl-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-600 dark:text-slate-300">
                    Customer Collections & Wire Transfers Received
                  </span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    +{formatUSD(moneyIn.customer_receipts)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-300">
                    Other Operating Inflows & Wire Credits
                  </span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    +{formatUSD(moneyIn.other_income)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Cash Outflows (Expandable) */}
          <div className="p-4 sm:p-6 space-y-3">
            <button
              type="button"
              onClick={() => setOutflowExpanded(!outflowExpanded)}
              className="w-full flex items-center justify-between text-slate-900 dark:text-slate-100 font-black text-xs uppercase tracking-wide border-b border-slate-200 dark:border-slate-800 pb-2 text-left"
            >
              <div className="flex items-center space-x-2">
                {outflowExpanded ? (
                  <ChevronDown className="w-4 h-4 text-rose-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-rose-700 dark:text-rose-400">Cash Outflows (Money Out)</span>
              </div>
              <span className="font-mono text-rose-600 dark:text-rose-400">
                -{formatUSD(moneyOut.total_out)}
              </span>
            </button>

            {outflowExpanded && (
              <div className="space-y-2 pl-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-600 dark:text-slate-300">
                    Transport Carrier Wire Disbursements (Sky Ariana Limited)
                  </span>
                  <span className="font-mono font-medium text-rose-600 dark:text-rose-400">
                    -{formatUSD(moneyOut.transport_payments)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-600 dark:text-slate-300">
                    Supplier Disbursements & Goods Procurement
                  </span>
                  <span className="font-mono font-medium text-rose-600 dark:text-rose-400">
                    -{formatUSD(moneyOut.supplier_payments)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-600 dark:text-slate-300">
                    General Operating & Administrative Expenses
                  </span>
                  <span className="font-mono font-medium text-rose-600 dark:text-rose-400">
                    -{formatUSD(moneyOut.expenses)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-300">
                    Bank Processing & International Wire Charges
                  </span>
                  <span className="font-mono font-medium text-rose-600 dark:text-rose-400">
                    -{formatUSD(moneyOut.bank_charges)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Net Cash Flow */}
          <div className="p-4 bg-slate-100/70 dark:bg-slate-800/40 flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
            <span>NET CASH FLOW FOR PERIOD</span>
            <span
              className={`font-mono text-sm ${
                netFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {netFlow >= 0 ? "+" : ""}{formatUSD(netFlow)}
            </span>
          </div>

          {/* Closing Cash */}
          <div className="p-5 bg-sky-50 dark:bg-sky-950/30 flex items-center justify-between font-black text-slate-900 dark:text-slate-100 text-sm">
            <span>CLOSING CASH & CASH EQUIVALENTS</span>
            <span className="font-mono text-base text-sky-700 dark:text-sky-300">
              {formatUSD(closingCash)}
            </span>
          </div>
        </div>
      </div>

      {/* Cash Flow Activity Feed / Transaction Log */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Recent Cash Activity & Wire Records
          </h2>
          <span className="badge badge-info text-xs font-mono">
            {transactions.length} Transactions
          </span>
        </div>

        {/* Mobile Cash Activity Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2.5 space-y-2.5">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Loading cash activity...
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No cash transactions recorded.
            </div>
          ) : (
            transactions.map((tx: any) => {
              const isInflow = tx.usd_equivalent_in > 0;
              const amt = isInflow ? tx.usd_equivalent_in : tx.usd_equivalent_out;

              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-slate-500">{tx.date}</span>
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                        {tx.transaction_code}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                        isInflow
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                      }`}
                    >
                      {isInflow ? "INFLOW (+)" : "OUTFLOW (-)"}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2 pt-0.5">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {tx.party_name || "General Ledger"}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                        {tx.bank_name}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono font-black text-sm ${
                          isInflow
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isInflow ? `+${formatUSD(amt)}` : `-${formatUSD(amt)}`}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 font-semibold">
                        Bal: {formatUSD(tx.running_balance)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table Container (>= md) */}
        <div className="hidden md:block table-container shadow-2xs">
          <table className="table">
            <thead>
              <tr>
                <th className="w-28">Date</th>
                <th className="w-32">Tx Code</th>
                <th>Bank Account</th>
                <th>Counterparty</th>
                <th>Type</th>
                <th className="text-right w-36">Inflow (+)</th>
                <th className="text-right w-36">Outflow (-)</th>
                <th className="text-right w-36">Running Cash</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                    Loading cash activity...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                    No cash transactions recorded.
                  </td>
                </tr>
              ) : (
                transactions.map((tx: any) => (
                  <tr key={tx.id}>
                    <td className="font-mono text-xs">{tx.date}</td>
                    <td className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                      {tx.transaction_code}
                    </td>
                    <td className="text-xs">{tx.bank_name}</td>
                    <td className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {tx.party_name}
                    </td>
                    <td>
                      <span className="badge badge-secondary text-[10px]">
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      {tx.usd_equivalent_in > 0 ? `+${formatUSD(tx.usd_equivalent_in)}` : "—"}
                    </td>
                    <td className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                      {tx.usd_equivalent_out > 0 ? `-${formatUSD(tx.usd_equivalent_out)}` : "—"}
                    </td>
                    <td className="text-right font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                      {formatUSD(tx.running_balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
