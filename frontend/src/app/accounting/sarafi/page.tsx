"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Phone,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  DollarSign,
  Search,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { VoucherPrintModal, VoucherData } from "@/components/VoucherPrintModal";
import { fetchApi, formatUSD } from "@/lib/api";

interface SarafiAccount {
  id: number;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  opening_balance: number;
  current_balance: number;
  contact_phone?: string;
  status: string;
  notes?: string;
}

interface SarafiTransaction {
  id: number;
  date: string;
  voucher_number?: string;
  transaction_code: string;
  party_name: string;
  type: string;
  money_in: number;
  money_out: number;
  reference: string;
  status: string;
  running_balance: number;
}

export default function SarafiLedgerPage() {
  const [accounts, setAccounts] = useState<SarafiAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [transactions, setTransactions] = useState<SarafiTransaction[]>([]);
  const [totalIn, setTotalIn] = useState<number>(0);
  const [totalOut, setTotalOut] = useState<number>(0);
  const [closingBalance, setClosingBalance] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);

  const loadAccounts = async () => {
    try {
      const res = await fetchApi<SarafiAccount[]>("/accounting/sarafi-accounts");
      setAccounts(res || []);
      if (res && res.length > 0 && !selectedAccountId) {
        setSelectedAccountId(String(res[0].id));
      }
    } catch (err) {
      console.error("Failed to load sarafi accounts:", err);
    }
  };

  const loadLedger = async () => {
    setLoading(true);
    try {
      let url = `/accounting/sarafi-ledger?account_type_filter=SARAFI`;
      if (selectedAccountId) url += `&account_id=${selectedAccountId}`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;

      const res = await fetchApi<any>(url);
      setTransactions(res.transactions || []);
      setTotalIn(res.total_in || 0);
      setTotalOut(res.total_out || 0);
      setClosingBalance(res.closing_balance || 0);
    } catch (err) {
      console.error("Failed to load sarafi ledger:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId || accounts.length > 0) {
      loadLedger();
    }
  }, [selectedAccountId, startDate, endDate]);

  const activeAccount = accounts.find((a) => a.id === Number(selectedAccountId));

  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-bold font-mono rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              SARAFI & HAWALA DESK
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Omid Ehsan • Kabul Shahzada Clearing
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Sarafi Accounts & Hawala Ledger
          </h1>
          <p className="text-xs text-slate-500">
            Dedicated liquid asset ledger for Afghan money brokers. Double-entry posting to GL Account 1030.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrintStatement}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Broker Statement</span>
          </button>
        </div>
      </div>

      <AccountingNav />

      {/* Broker Accounts Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((acc) => {
          const isSelected = String(acc.id) === selectedAccountId;
          return (
            <button
              key={acc.id}
              onClick={() => setSelectedAccountId(String(acc.id))}
              className={`p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? "bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-500 dark:border-indigo-400 shadow-xs ring-1 ring-indigo-500/20"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {acc.bank_name}
                </span>
                <span className="px-2 py-0.5 text-3xs font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {acc.currency}
                </span>
              </div>
              <div className="mt-2">
                <span className="text-3xs text-slate-400 block">Current Balance</span>
                <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                  {acc.currency} {acc.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              {acc.contact_phone && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-1 text-3xs text-slate-500">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{acc.contact_phone}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Statement & Ledger Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden print:border-none print:shadow-none">
        {/* Ledger Header & Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {activeAccount?.bank_name || "Sarafi"} — Official Statement
            </h2>
            <p className="text-2xs text-slate-500 font-mono">
              Account Code: GL 1030 • Currency: {activeAccount?.currency || "USD"}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-slate-400 text-2xs">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-1 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
              />
              <span className="text-slate-400 text-2xs">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-1 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
              />
            </div>
            <button
              onClick={loadLedger}
              className="p-1.5 text-slate-500 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Totals Banner */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-2xs text-slate-500 uppercase font-semibold">Total Hawala In (+)</span>
            <div className="text-base font-black font-mono text-emerald-600">
              +{formatUSD(totalIn)}
            </div>
          </div>
          <div>
            <span className="text-2xs text-slate-500 uppercase font-semibold">Total Hawala Out (-)</span>
            <div className="text-base font-black font-mono text-rose-600">
              -{formatUSD(totalOut)}
            </div>
          </div>
          <div>
            <span className="text-2xs text-slate-500 uppercase font-semibold">Current Closing Standing</span>
            <div className="text-base font-black font-mono text-slate-900 dark:text-white">
              {formatUSD(closingBalance)}
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-2xs font-semibold">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Voucher #</th>
                <th className="px-4 py-3">Particulars / Party</th>
                <th className="px-4 py-3">Reference / Hawala #</th>
                <th className="px-4 py-3 text-right">Debit / In (+)</th>
                <th className="px-4 py-3 text-right">Credit / Out (-)</th>
                <th className="px-4 py-3 text-right">Running Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No transactions recorded for this Sarafi account.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-slate-500">{tx.date}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          setActiveVoucher({
                            voucher_number: tx.voucher_number || tx.transaction_code,
                            date: tx.date,
                            party_name: tx.party_name,
                            account_name: activeAccount?.bank_name || "Sarafi",
                            transaction_type: tx.type,
                            amount: tx.money_in > 0 ? tx.money_in : tx.money_out,
                            currency: activeAccount?.currency || "USD",
                            reference: tx.reference,
                            status: tx.status,
                          })
                        }
                        className="font-mono font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        {tx.voucher_number || tx.transaction_code}
                      </button>
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
                      {tx.money_in > 0 ? `+${formatUSD(tx.money_in)}` : "-"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-rose-600">
                      {tx.money_out > 0 ? `-${formatUSD(tx.money_out)}` : "-"}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-right text-slate-900 dark:text-white">
                      {formatUSD(tx.running_balance)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 text-2xs font-semibold rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center print:hidden">
                      <button
                        onClick={() =>
                          setActiveVoucher({
                            voucher_number: tx.voucher_number || tx.transaction_code,
                            date: tx.date,
                            party_name: tx.party_name,
                            account_name: activeAccount?.bank_name || "Sarafi",
                            transaction_type: tx.type,
                            amount: tx.money_in > 0 ? tx.money_in : tx.money_out,
                            currency: activeAccount?.currency || "USD",
                            reference: tx.reference,
                            status: tx.status,
                          })
                        }
                        className="p-1 text-slate-400 hover:text-indigo-600"
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

      <VoucherPrintModal voucher={activeVoucher} onClose={() => setActiveVoucher(null)} />
    </div>
  );
}
