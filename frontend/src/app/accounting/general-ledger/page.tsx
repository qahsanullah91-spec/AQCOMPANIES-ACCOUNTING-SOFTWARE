"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";
import {
  PdfDownloadButton,
  PrintButton,
  MoneyDisplay,
} from "@/components/accounting";

interface LedgerEntry {
  id: number;
  entry_number: string;
  date: string;
  entry_type: string;
  account_code: string;
  account_name: string;
  party_type: string | null;
  party_name: string | null;
  debit: number;
  credit: number;
  currency: string;
  amount_currency: number;
  exchange_rate: number;
  running_balance: number;
  invoice_ref: string | null;
  shipment_ref: string | null;
  bank_ref: string | null;
  description: string;
  created_by: string;
  created_at: string | null;
}

interface Account {
  id: number;
  account_code: string;
  account_name: string;
}

export default function GeneralLedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [mobileViewMode, setMobileViewMode] = useState<"card" | "table">("card");

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filters
  const [selectedAccount, setSelectedAccount] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const limit = 150;

  const loadAccounts = async () => {
    try {
      const data = await fetchApi<Account[]>("/accounting/accounts");
      setAccounts(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadLedger = async () => {
    try {
      setLoading(true);
      let url = `/accounting/general-ledger?limit=${limit}&offset=${page * limit}`;
      if (selectedAccount) url += `&account_code=${selectedAccount}`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;

      const res = await fetchApi<{ total_records: number; entries: LedgerEntry[] }>(url);
      setEntries(res?.entries || []);
      setTotalRecords(res?.total_records || 0);
    } catch (err) {
      console.error("Failed to load general ledger:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    loadLedger();
  }, [selectedAccount, startDate, endDate, page]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.entry_number.toLowerCase().includes(s) ||
      e.account_code.toLowerCase().includes(s) ||
      e.account_name.toLowerCase().includes(s) ||
      (e.party_name && e.party_name.toLowerCase().includes(s)) ||
      (e.invoice_ref && e.invoice_ref.toLowerCase().includes(s)) ||
      (e.description && e.description.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-sky-600" />
            General Ledger
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Double-Entry Audit Trail • Real-Time Running Balances
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <PdfDownloadButton
            url={`/api/v1/accounting/general-ledger.pdf?${selectedAccount ? `account_code=${selectedAccount}&` : ""}${startDate ? `start_date=${startDate}&` : ""}${endDate ? `end_date=${endDate}` : ""}`}
            filename={`AQ-General-Ledger-${selectedAccount || "Global"}.pdf`}
            label="Download PDF"
            size="sm"
          />
          <PrintButton label="Print" size="sm" />
          <div className="text-xs font-mono font-bold text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-2xs">
            {totalRecords} Entries
          </div>
        </div>
      </div>

      <AccountingNav />

      {/* Filter Matrix */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
            Account Filter
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => {
              setSelectedAccount(e.target.value);
              setPage(0);
            }}
            className="select w-full"
          >
            <option value="">All Accounts (Global GL)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.account_code}>
                {a.account_code} — {a.account_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
            Search Keyword
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Journal #, party, invoice ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8 w-full"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
            From Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(0);
            }}
            className="input w-full"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
            To Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(0);
            }}
            className="input w-full"
          />
        </div>
      </div>

      {/* Mobile Card / Table View Toggle */}
      <div className="flex md:hidden items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setMobileViewMode("card")}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            mobileViewMode === "card"
              ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          Card View
        </button>
        <button
          type="button"
          onClick={() => setMobileViewMode("table")}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            mobileViewMode === "table"
              ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          Table View
        </button>
      </div>

      {/* Ledger Table */}
      <div className={`${mobileViewMode === "table" ? "block" : "hidden"} md:block table-container shadow-2xs`}>
        <table className="table">
          <thead>
            <tr>
              <th className="w-24">Date</th>
              <th className="w-28">Journal #</th>
              <th>Account</th>
              <th>Party / Entity</th>
              <th>Reference / Memo</th>
              <th className="text-right w-28">Debit (USD)</th>
              <th className="text-right w-28">Credit (USD)</th>
              <th className="text-right w-32">Running Bal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                  Loading General Ledger records...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                  No ledger entries found matching filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                    {row.date}
                  </td>
                  <td className="font-mono font-bold text-sky-600 dark:text-sky-400 text-[11px]">
                    {row.entry_number}
                  </td>
                  <td>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {row.account_code} — {row.account_name}
                    </div>
                  </td>
                  <td>
                    {row.party_name ? (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {row.party_name}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td>
                    <div className="text-xs text-slate-700 dark:text-slate-300 max-w-xs truncate">
                      {row.description}
                    </div>
                    {row.invoice_ref && (
                      <span className="badge badge-neutral text-[9px] font-mono mt-0.5">
                        {row.invoice_ref}
                      </span>
                    )}
                  </td>
                  <td className="text-right font-mono text-xs">
                    {row.debit > 0 ? <MoneyDisplay amount={row.debit} /> : "—"}
                  </td>
                  <td className="text-right font-mono text-xs">
                    {row.credit > 0 ? <MoneyDisplay amount={row.credit} /> : "—"}
                  </td>
                  <td className="text-right font-mono text-xs">
                    <MoneyDisplay amount={row.running_balance} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Expandable Ledger Cards (iPhone / Small Viewports) */}
      <div className={`${mobileViewMode === "card" ? "block" : "hidden"} md:hidden space-y-2.5`}>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs card">
            Loading General Ledger records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs card">
            No ledger entries found matching filters.
          </div>
        ) : (
          filtered.map((row) => {
            const isExpanded = !!expandedRows[row.id];
            const hasDebit = row.debit > 0;

            return (
              <div
                key={row.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs transition-all"
              >
                {/* Collapsed Header: Date, Journal #, Chevron */}
                <div
                  onClick={() => toggleRow(row.id)}
                  className="flex items-center justify-between cursor-pointer pb-2 border-b border-slate-100 dark:border-slate-800/80"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[11px] text-slate-500 font-semibold">{row.date}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                      {row.entry_number}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 text-slate-400">
                    <span className="text-[10px] uppercase font-bold">{isExpanded ? "Less" : "More"}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Account & Memo Summary */}
                <div onClick={() => toggleRow(row.id)} className="py-2 cursor-pointer">
                  <div className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                    {row.account_code} — {row.account_name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {row.description || "Ledger entry"}
                  </div>
                </div>

                {/* Amount Row: Debit / Credit Pill & Running Balance */}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800 text-xs font-mono">
                  <div className="flex items-center space-x-1.5">
                    {hasDebit ? (
                      <span className="font-black text-sky-700 dark:text-sky-400">
                        DR +{formatUSD(row.debit)}
                      </span>
                    ) : (
                      <span className="font-black text-amber-700 dark:text-amber-400">
                        CR -{formatUSD(row.credit)}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 font-semibold text-[11px]">
                    Bal: <span className="font-bold text-slate-800 dark:text-slate-200">{formatUSD(row.running_balance)}</span>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800 space-y-1.5 text-[11px] bg-slate-50/60 dark:bg-slate-950/40 p-2.5 rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Party / Entity:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{row.party_name || "—"}</span>
                    </div>
                    {row.invoice_ref && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Invoice Ref:</span>
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{row.invoice_ref}</span>
                      </div>
                    )}
                    {row.bank_ref && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Bank Ref:</span>
                        <span className="font-mono font-bold">{row.bank_ref}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Debit:</span>
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{row.debit > 0 ? formatUSD(row.debit) : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Credit:</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{row.credit > 0 ? formatUSD(row.credit) : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Running Balance:</span>
                      <span className="font-mono font-black text-slate-900 dark:text-white">{formatUSD(row.running_balance)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {totalRecords > limit && (
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
          <div>
            Showing {page * limit + 1}–{Math.min((page + 1) * limit, totalRecords)} of {totalRecords} records
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="btn btn-secondary py-1 px-3 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="font-bold">Page {page + 1}</span>
            <button
              disabled={(page + 1) * limit >= totalRecords}
              onClick={() => setPage(page + 1)}
              className="btn btn-secondary py-1 px-3 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
