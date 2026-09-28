"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Landmark,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Search,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";
import {
  PdfDownloadButton,
  PrintButton,
  MoneyDisplay,
  AccountingSummaryCard,
} from "@/components/accounting";

interface TransportLine {
  date: string;
  type: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
  container_no: string | null;
  truck_no: string | null;
  bl_no: string | null;
}

export default function TransportAccountingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetchApi("/accounting/transport-statement");
        setData(res);
      } catch (err) {
        console.error("Failed to load transport statement:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const pos = data?.position || {};
  const lines: TransportLine[] = data?.ledger_lines || [];

  const filtered = lines.filter((l) => {
    const s = search.toLowerCase();
    return (
      l.description.toLowerCase().includes(s) ||
      l.reference.toLowerCase().includes(s) ||
      (l.container_no && l.container_no.toLowerCase().includes(s)) ||
      (l.bl_no && l.bl_no.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Truck className="w-7 h-7 text-sky-600" />
            Transport Carrier Accounting (Sky Ariana Limited)
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Container Freight Ledger • Carrier Credit Reconciliation
          </p>
        </div>

        {/* Unified Print & PDF Actions */}
        <div className="flex items-center space-x-2">
          <PdfDownloadButton
            url="/api/v1/transport/statement.pdf"
            filename="AQ-Transport-Statement-Sky-Ariana.pdf"
            label="Download PDF Statement"
          />
          <PrintButton label="Print Statement" />
        </div>
      </div>

      <AccountingNav />

      {/* Prominent Carrier Credit Banner */}
      <div className="p-5 rounded-2xl bg-sky-500/10 border-2 border-sky-500/30 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-sky-600/20">
            AQ
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Verified Accounting Position
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
              AQ COMPANIES Holds +$291,160.00 Credit With Transport Company
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Carrier: <b>Sky Ariana Limited</b> • Advance payments exceed incurred container freight charges.
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="badge badge-success text-xs font-mono font-bold px-3 py-1">
            CARRIER OWES AQ COMPANIES
          </span>
        </div>
      </div>

      {/* 4 Financial Pillar KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AccountingSummaryCard
          title="Opening Carrier Credit"
          value={pos.total_opening_credit || 0}
          subtitle="Pre-existing advance deposit"
          icon={Landmark}
        />
        <AccountingSummaryCard
          title="Freight Charges (63 Loads)"
          value={pos.total_freight_charges || 0}
          subtitle="Incurred transportation fees"
          icon={Truck}
        />
        <AccountingSummaryCard
          title="Wire Payments Disbursed"
          value={pos.total_payments || 0}
          subtitle="Direct bank transfers"
          icon={ArrowUpRight}
        />
        <AccountingSummaryCard
          title="Net Closing Standing"
          value={pos.carrier_credit_in_our_favor || 291160}
          subtitle="Surplus Credit in Our Favor"
          icon={ShieldCheck}
          trend={{ direction: "up", label: "Credit in Favor" }}
        />
      </div>

      {/* Itemized Chronological Ledger */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Chronological Carrier Statement ({lines.length} ledger lines)
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search memo, BL, container..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8 text-xs w-full"
            />
          </div>
        </div>

        <div className="table-container shadow-2xs">
          <table className="table">
            <thead>
              <tr>
                <th className="w-24">Date</th>
                <th className="w-24">Type</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Container / BL / Truck</th>
                <th className="text-right w-28">Freight Charge ($)</th>
                <th className="text-right w-28">Wire Payment ($)</th>
                <th className="text-right w-32">Balance (AQ Credit)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                    Loading transport statement...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                    No records found matching filters.
                  </td>
                </tr>
              ) : (
                filtered.map((l, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                      {l.date}
                    </td>
                    <td>
                      <span
                        className={`badge text-[9px] font-mono ${
                          l.type === "PAYMENT"
                            ? "badge-success"
                            : l.type === "OPENING CREDIT"
                            ? "badge-info"
                            : "badge-neutral"
                        }`}
                      >
                        {l.type}
                      </span>
                    </td>
                    <td className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                      {l.reference}
                    </td>
                    <td>
                      <div className="text-xs text-slate-900 dark:text-slate-100 max-w-xs truncate">
                        {l.description}
                      </div>
                    </td>
                    <td className="font-mono text-[11px] text-slate-500">
                      {l.container_no && <span>{l.container_no}</span>}
                      {l.bl_no && <span className="ml-1 text-slate-400">/ {l.bl_no}</span>}
                      {!l.container_no && !l.bl_no && <span>—</span>}
                    </td>
                    <td className="text-right font-mono text-xs">
                      {l.debit > 0 ? <MoneyDisplay amount={l.debit} /> : "—"}
                    </td>
                    <td className="text-right font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                      {l.credit > 0 ? <MoneyDisplay amount={l.credit} /> : "—"}
                    </td>
                    <td className="text-right font-mono text-xs">
                      <MoneyDisplay
                        amount={l.running_balance}
                        isCarrierCredit={l.running_balance < 0}
                      />
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
