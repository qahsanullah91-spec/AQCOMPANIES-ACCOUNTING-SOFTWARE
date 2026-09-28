"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Receipt,
  Ship,
  CreditCard,
  FileText,
  DollarSign,
  TrendingUp,
  Download,
  Phone,
  Mail,
  MapPin,
  Building2,
  Calendar,
  AlertTriangle,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { fetchApi, formatUSD, formatWeight, formatNumber, formatRate, API_BASE } from "@/lib/api";

interface CustomerLedgerEntry {
  date: string;
  invoice: string;
  shipment: string;
  description: string;
  debit: number;
  credit: number;
  payment_reference: string | null;
  bank: string | null;
  notes: string | null;
  balance: number;
}

interface CustomerProfile {
  id: number;
  customer_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  country: string;
  gst: string | null;
  pan: string | null;
  iec: string | null;
  notes: string | null;
}

interface CustomerSummary {
  total_invoices: number;
  total_sales: number;
  total_paid: number;
  total_outstanding: number;
  total_containers: number;
  total_kg: number;
  total_profit: number | null;
  average_sale_rate: number;
  total_advance?: number;
}

interface CustomerLedgerData {
  profile: CustomerProfile;
  summary: CustomerSummary;
  ledger: CustomerLedgerEntry[];
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<CustomerLedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "ledger" | "invoices" | "shipments" | "payments" | "receivables" | "documents"
  >("overview");

  useEffect(() => {
    if (!id) return;
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetchApi<CustomerLedgerData>(`/customers/${id}/ledger`);
        setData(res);
      } catch (err: any) {
        setError(err.message || "Failed to load customer account ledger");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500">Loading customer account #{id}...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="card p-6 bg-rose-50 border-rose-200 text-rose-800 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            Customer Account Not Found
          </div>
          <p className="text-xs">{error || `Unable to locate customer with ID ${id}.`}</p>
          <button
            onClick={() => router.push("/customers")}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Customers
          </button>
        </div>
      </div>
    );
  }

  const { profile, summary, ledger } = data;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/customers")}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-sky-600" />
              {profile.customer_name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Country: <span className="font-semibold text-slate-700 dark:text-slate-300">{profile.country}</span> •{" "}
              {profile.address || "Delhi / Mumbai, India"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/payments?customer_id=${profile.id}&action=receipt`}
            className="btn btn-primary text-xs flex items-center gap-1.5 font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> + Customer Receipt
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-3 sm:p-4 bg-white dark:bg-slate-900 border-l-4 border-l-rose-500 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding Receivable</p>
          <p className="text-lg sm:text-xl font-black text-rose-600 mt-1 font-mono tabular-nums">
            {formatUSD(summary.total_outstanding)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Payment Balance Due</p>
        </div>

        <div className="card p-3 sm:p-4 bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Received Money</p>
          <p className="text-lg sm:text-xl font-black text-emerald-600 mt-1 font-mono tabular-nums">
            {formatUSD(summary.total_paid)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Bank Wire Remittances</p>
        </div>

        <div className="card p-3 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sales Billed</p>
          <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 font-mono tabular-nums">
            {formatUSD(summary.total_sales)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{summary.total_invoices} Invoices Billed</p>
        </div>

        <div className="card p-3 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Advances / Unallocated</p>
          <p className="text-lg sm:text-xl font-black text-amber-600 mt-1 font-mono tabular-nums">
            {formatUSD(summary.total_advance || 0)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Prepayments on Account</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-bold">
        {[
          { key: "overview", label: "Overview", icon: Users },
          { key: "ledger", label: `Statement Ledger (${ledger.length})`, icon: DollarSign },
          { key: "invoices", label: `Invoices (${summary.total_invoices})`, icon: Receipt },
          { key: "shipments", label: "Shipments", icon: Ship },
          { key: "payments", label: "Payments Received", icon: CreditCard },
          { key: "receivables", label: "Receivables Aging", icon: TrendingUp },
          { key: "documents", label: "Documents", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                isActive
                  ? "border-sky-600 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div>
        {/* 1. OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b pb-2">
                Business Profile & Legal Details
              </h2>
              <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                <div>
                  <dt className="text-slate-400 font-medium">Customer Legal Name</dt>
                  <dd className="font-bold text-slate-900 dark:text-white mt-0.5">{profile.customer_name}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Country / Market</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{profile.country}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Contact Person</dt>
                  <dd className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {profile.contact_person || "Accounts Department"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Phone</dt>
                  <dd className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">{profile.phone || "N/A"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">GST Number</dt>
                  <dd className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">{profile.gst || "N/A"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">IEC Number</dt>
                  <dd className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">{profile.iec || "N/A"}</dd>
                </div>
              </dl>
            </div>

            <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b pb-2">
                Commercial Account Performance
              </h2>
              <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                <div>
                  <dt className="text-slate-400 font-medium">Average Realized Rate</dt>
                  <dd className="font-mono font-bold text-sky-600 mt-0.5">
                    {formatRate(summary?.average_sale_rate)} / KG
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Outstanding Balance</dt>
                  <dd className="font-mono font-bold text-rose-600 mt-0.5">
                    {formatUSD(summary.total_outstanding)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Total Invoices</dt>
                  <dd className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">{summary.total_invoices}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Total Containers</dt>
                  <dd className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">{summary.total_containers}</dd>
                </div>
              </dl>
              <div className="pt-2 text-xs text-slate-500">
                <span className="font-bold">Account Notes: </span>
                <span>{profile.notes || "Excel master ledger account profile."}</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. STATEMENT LEDGER */}
        {(activeTab === "ledger" || activeTab === "receivables" || activeTab === "invoices") && (
          <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Customer Statement Ledger</h2>
                <p className="text-xs text-slate-500">
                  Chronological billing debits, wire credits, and running account balances.
                </p>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 font-mono">Invoice #</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (Sales USD)</th>
                    <th className="py-2.5 px-3 text-right">Credit (Paid USD)</th>
                    <th className="py-2.5 px-3 text-right">Running Balance</th>
                    <th className="py-2.5 px-3">Reference / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {ledger.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">{entry.date}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                        {entry.invoice}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {entry.description}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {entry.debit > 0 ? formatUSD(entry.debit) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                        {entry.credit > 0 ? formatUSD(entry.credit) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-rose-600">
                        {formatUSD(entry.balance)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{entry.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                  <tr>
                    <td colSpan={3} className="py-3 px-3 uppercase text-slate-600 dark:text-slate-300">
                      Closing Statement Position:
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                      {formatUSD(summary.total_sales)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-600">
                      {formatUSD(summary.total_paid)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-rose-600 text-sm">
                      {formatUSD(summary.total_outstanding)}
                    </td>
                    <td className="py-3 px-3 text-slate-400">Receivable in AQ Companies' Favor</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Compact Statement Rows */}
            <div className="block md:hidden space-y-2.5">
              {ledger.map((entry, idx) => {
                const isExpanded = expandedRow === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/60 p-3 space-y-2"
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => setExpandedRow(isExpanded ? null : idx)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{entry.date}</span>
                        <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded">
                          {entry.invoice}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">Bal:</span>
                        <span className="font-mono text-xs font-black text-rose-600">
                          {formatUSD(entry.balance)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    <div
                      className="flex items-center justify-between text-xs cursor-pointer"
                      onClick={() => setExpandedRow(isExpanded ? null : idx)}
                    >
                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[200px]">
                        {entry.description}
                      </span>
                      <div className="text-right font-mono font-bold">
                        {entry.debit > 0 && (
                          <span className="text-slate-900 dark:text-white">+{formatUSD(entry.debit)}</span>
                        )}
                        {entry.credit > 0 && (
                          <span className="text-emerald-600">-{formatUSD(entry.credit)}</span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pt-2.5 mt-2 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2.5">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 block font-medium">Journal Reference:</span>
                            <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                              {entry.payment_reference || entry.invoice || "GL Ledger Entry"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Bank / Wire:</span>
                            <span className="font-mono text-slate-800 dark:text-slate-200">
                              {entry.bank || "AQ USD Wire"}
                            </span>
                          </div>
                          {entry.notes && (
                            <div className="col-span-2">
                              <span className="text-slate-400 block font-medium">Notes:</span>
                              <span className="text-slate-600 dark:text-slate-300">{entry.notes}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <Link
                            href={`/invoices?search=${encodeURIComponent(entry.invoice)}`}
                            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 flex items-center gap-1"
                          >
                            <Receipt className="w-3 h-3" /> View Invoice
                          </Link>
                          <Link
                            href={`/payments?customer_id=${profile.id}&action=receipt&invoice=${encodeURIComponent(entry.invoice)}`}
                            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Receive Money
                          </Link>
                          <button
                            onClick={() => window.print()}
                            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" /> Download PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Mobile Summary Footer */}
              <div className="p-3 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl space-y-1.5 text-xs font-semibold">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Total Sales Billed:</span>
                  <span className="font-mono text-slate-900 dark:text-white font-bold">{formatUSD(summary.total_sales)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Total Received:</span>
                  <span className="font-mono text-emerald-600 font-bold">{formatUSD(summary.total_paid)}</span>
                </div>
                <div className="flex justify-between text-rose-600 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Closing Balance Due:</span>
                  <span className="font-mono text-sm font-black">{formatUSD(summary.total_outstanding)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. PAYMENTS */}
        {activeTab === "payments" && (
          <div className="card p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <CreditCard className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Payments Recorded to Date</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No wire remittances have been allocated for {profile.customer_name} yet. Incoming wire transfers from
              banks or third parties can be allocated using the Customer Receipt button above.
            </p>
            <Link
              href={`/payments?customer_id=${profile.id}&action=receipt`}
              className="btn btn-primary text-xs inline-flex items-center gap-1.5 font-bold mt-2"
            >
              <Plus className="w-3.5 h-3.5" /> Record Bank Wire Receipt
            </Link>
          </div>
        )}

        {/* 4. DOCUMENTS */}
        {activeTab === "documents" && (
          <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Shipping Documents</h3>
            <p className="text-xs text-slate-500">
              Commercial invoices and packing lists for {profile.customer_name}.
            </p>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {ledger
                .filter((l) => l.invoice && l.invoice.startsWith("INV-"))
                .map((l, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-600" />
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{l.invoice}</span>
                      <span className="text-slate-400">({l.description})</span>
                    </div>
                    <a
                      href={`${API_BASE}/invoices/by-number/${l.invoice}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Invoice PDF
                    </a>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
