"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Filter,
  DollarSign,
  CreditCard,
  Clock,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface ReceivableItem {
  id: number;
  invoice_number: string;
  date: string;
  customer_id: number;
  customer_name: string;
  total_amount: number;
  amount_received: number;
  balance_due: number;
  days_outstanding: number;
  payment_status: string;
  payment_terms: string | null;
  shipment_id: number | null;
}

export default function CustomerReceivablesPage() {
  const [receivables, setReceivables] = useState<ReceivableItem[]>([]);
  const [agingData, setAgingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("ALL");

  const loadData = async () => {
    try {
      setLoading(true);
      const [recData, ageData] = await Promise.all([
        fetchApi<ReceivableItem[]>("/accounting/receivables"),
        fetchApi<any>("/accounting/receivables/aging"),
      ]);
      setReceivables(recData || []);
      setAgingData(ageData || null);
    } catch (err) {
      console.error("Failed to load receivables:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalInvoiced = receivables.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const totalReceived = receivables.reduce((sum, r) => sum + (r.amount_received || 0), 0);
  const totalBalance = receivables.reduce((sum, r) => sum + (r.balance_due || 0), 0);

  const filtered = receivables.filter((r) => {
    const matchesSearch =
      r.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      r.customer_name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || r.payment_status === statusFilter;

    const matchesCustomer =
      selectedCustomerId === "ALL" || String(r.customer_id) === selectedCustomerId;

    return matchesSearch && matchesStatus && matchesCustomer;
  });

  const uniqueCustomers = Array.from(
    new Map(receivables.map((r) => [r.customer_id, r.customer_name])).entries()
  );

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-sky-600" />
            Accounts Receivable & Aging Report
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Trade Receivables from 16 Indian Dry Fruit Buyers
          </p>
        </div>

        <Link
          href="/accounting/allocation"
          className="btn btn-primary text-xs font-bold flex items-center gap-1.5"
        >
          <CreditCard className="w-4 h-4" />
          <span>Allocate Customer Wire</span>
        </Link>
      </div>

      <AccountingNav />

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sales Invoiced</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatUSD(totalInvoiced)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">63 Invoices Issued</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payments Collected</div>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatUSD(totalReceived)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Bank Wire Receipts</div>
        </div>

        <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            Total Outstanding Due
          </div>
          <div className="text-lg font-black text-rose-700 dark:text-rose-300 mt-1">
            {formatUSD(totalBalance)}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-1">Uncollected Balance</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overdue (90+ Days)</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            $0.00
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-0.5" /> All Current Within 60 Days
          </div>
        </div>
      </div>

      {/* Aging Buckets Banner */}
      {agingData && (
        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
            <span>Portfolio Aging Maturity Schedule</span>
            <span className="text-slate-400 font-mono text-[11px]">As of Today</span>
          </div>

          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">0–30 Days (Current)</span>
              <div className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                {formatUSD(agingData.summary?.current_0_30)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">31–60 Days</span>
              <div className="text-sm font-black text-amber-700 dark:text-amber-300 mt-0.5">
                {formatUSD(agingData.summary?.aging_31_60)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-500">61–90 Days</span>
              <div className="text-sm font-black text-slate-400 mt-0.5">$0.00</div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-500">90+ Days Overdue</span>
              <div className="text-sm font-black text-slate-400 mt-0.5">$0.00</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="relative w-full md:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Invoice # or Customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8 w-full"
            />
          </div>

          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="select"
          >
            <option value="ALL">All 16 Buyers</option>
            {uniqueCustomers.map(([id, name]) => (
              <option key={id} value={String(id)}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNPAID">UNPAID</option>
            <option value="PARTIALLY PAID">PARTIALLY PAID</option>
            <option value="PAID">PAID</option>
          </select>
        </div>

        <div className="text-slate-500 text-[11px]">
          Showing <b>{filtered.length}</b> invoices
        </div>
      </div>

      {/* Receivables Table */}
      <div className="table-container shadow-2xs">
        <table className="table">
          <thead>
            <tr>
              <th className="w-24">Date</th>
              <th className="w-28">Invoice #</th>
              <th>Customer / Buyer</th>
              <th>Payment Terms</th>
              <th className="text-right w-28">Invoice Amount</th>
              <th className="text-right w-28">Paid</th>
              <th className="text-right w-28">Balance Due</th>
              <th className="text-center w-24">Days Aged</th>
              <th className="text-center w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                  Loading receivables...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                  No invoices found matching criteria.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                    {r.date}
                  </td>
                  <td className="font-mono font-bold text-sky-600 dark:text-sky-400 text-[11px]">
                    {r.invoice_number}
                  </td>
                  <td>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {r.customer_name}
                    </span>
                  </td>
                  <td className="text-slate-500 text-[11px] truncate max-w-xs">
                    {r.payment_terms || "100% Advance"}
                  </td>
                  <td className="text-right font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                    {r.total_amount > 0 ? formatUSD(r.total_amount) : <span className="text-amber-500 font-semibold">Unpriced</span>}
                  </td>
                  <td className="text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    {r.amount_received > 0 ? formatUSD(r.amount_received) : "—"}
                  </td>
                  <td className="text-right font-mono font-black text-xs text-rose-600 dark:text-rose-400">
                    {r.balance_due > 0 ? formatUSD(r.balance_due) : "—"}
                  </td>
                  <td className="text-center font-mono text-xs">
                    <span
                      className={`badge text-[10px] ${
                        r.days_outstanding <= 30
                          ? "badge-success"
                          : r.days_outstanding <= 60
                          ? "badge-warning"
                          : "badge-danger"
                      }`}
                    >
                      {r.days_outstanding} d
                    </span>
                  </td>
                  <td className="text-center">
                    <span
                      className={`badge text-[10px] ${
                        r.payment_status === "PAID"
                          ? "badge-success"
                          : r.payment_status === "PARTIALLY PAID"
                          ? "badge-warning"
                          : "badge-danger"
                      }`}
                    >
                      {r.payment_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
