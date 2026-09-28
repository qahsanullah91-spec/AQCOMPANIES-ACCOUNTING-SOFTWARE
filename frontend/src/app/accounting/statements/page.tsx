"use client";

import React, { useState, useEffect } from "react";
import {
  FileCheck2,
  Printer,
  Download,
  Calendar,
  Users,
  Building2,
  Truck,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
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

type PartyType = "customer" | "supplier" | "transport" | "bank";

export default function AccountStatementsPage() {
  const [partyType, setPartyType] = useState<PartyType>("customer");
  const [partyList, setPartyList] = useState<any[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [statementData, setStatementData] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Load parties when partyType changes
  useEffect(() => {
    async function loadParties() {
      try {
        let endpoint = "";
        if (partyType === "customer") endpoint = "/customers";
        else if (partyType === "supplier") endpoint = "/suppliers";
        else if (partyType === "transport") endpoint = "/transport-companies";
        else if (partyType === "bank") endpoint = "/accounting/banks";

        const res = await fetchApi(endpoint);
        const list = Array.isArray(res) ? res : [];
        setPartyList(list);

        if (list.length > 0) {
          setSelectedPartyId(list[0].id);
        } else {
          setSelectedPartyId(null);
          setStatementData(null);
        }
      } catch (err) {
        console.error("Error fetching party list:", err);
      }
    }
    loadParties();
  }, [partyType]);

  // Load statement when selectedPartyId changes or date changes
  const loadStatement = async () => {
    if (!selectedPartyId) return;
    try {
      setLoading(true);
      let url = `/accounting/statements/${partyType}/${selectedPartyId}`;
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetchApi(url);
      setStatementData(res);
    } catch (err) {
      console.error("Error loading statement:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPartyId) {
      loadStatement();
    }
  }, [selectedPartyId, partyType]);

  const handleExportCSV = () => {
    if (!statementData || !statementData.lines || statementData.lines.length === 0) return;
    const headers = ["Date", "Reference", "Description", "Debit (USD)", "Credit (USD)", "Running Balance (USD)"];
    const rows = statementData.lines.map((l: any) => [
      l.date,
      `"${l.reference || ""}"`,
      `"${(l.description || "").replace(/"/g, '""')}"`,
      l.debit,
      l.credit,
      l.balance,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Statement_${partyType}_${statementData.party_name}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const lines = statementData?.lines || [];
  const closingBal = statementData?.closing_balance || 0;
  const totalDebits = lines.reduce((acc: number, cur: any) => acc + (cur.debit || 0), 0);
  const totalCredits = lines.reduce((acc: number, cur: any) => acc + (cur.credit || 0), 0);

  const pdfUrl = selectedPartyId
    ? partyType === "customer"
      ? `/api/v1/customers/${selectedPartyId}/statement.pdf`
      : partyType === "transport"
      ? `/api/v1/transport/${selectedPartyId}/statement.pdf`
      : partyType === "supplier"
      ? `/api/v1/suppliers/${selectedPartyId}/statement.pdf`
      : `/api/v1/banking/accounts/${selectedPartyId}/statement.pdf`
    : "";

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-7 h-7 text-sky-600" />
            Official Account Statements
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Chronological Ledger Statements for Customers, Transporters, Suppliers & Banks
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {pdfUrl && (
            <PdfDownloadButton
              url={pdfUrl}
              filename={`AQ-Statement-${partyType}-${statementData?.party_name || selectedPartyId}.pdf`}
              label="Download Official PDF"
              size="sm"
            />
          )}
          <button
            onClick={handleExportCSV}
            disabled={!statementData || lines.length === 0}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <PrintButton label="Print" size="sm" />
        </div>
      </div>

      <AccountingNav />

      {/* Party Type Category Selector */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-2xs">
        {[
          { type: "customer" as PartyType, label: "Customer Statements", icon: Users },
          { type: "transport" as PartyType, label: "Transport Carrier (Sky Ariana)", icon: Truck },
          { type: "bank" as PartyType, label: "Bank Account Statements", icon: Landmark },
          { type: "supplier" as PartyType, label: "Supplier Statements", icon: Building2 },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = partyType === item.type;
          return (
            <button
              key={item.type}
              onClick={() => setPartyType(item.type)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter and Entity Selection Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        {/* Entity Dropdown */}
        <div className="flex items-center space-x-3 text-xs flex-1 min-w-[280px]">
          <label className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            Select {partyType.charAt(0).toUpperCase() + partyType.slice(1)}:
          </label>
          <select
            value={selectedPartyId || ""}
            onChange={(e) => setSelectedPartyId(Number(e.target.value))}
            className="input py-1.5 text-xs font-medium flex-1"
          >
            {partyList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.customer_name || p.company_name || p.bank_name || p.supplier_name}
                {p.currency ? ` (${p.currency})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filters */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input py-1 text-xs"
            />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input py-1 text-xs"
            />
          </div>
          <button
            onClick={loadStatement}
            className="btn btn-secondary text-xs py-1 px-3"
          >
            Filter
          </button>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                loadStatement();
              }}
              className="btn btn-ghost text-xs py-1 px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Statement Header Card */}
      {statementData && (
        <div className="card p-6 bg-linear-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/60 border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center space-x-2">
                <span className="badge badge-info text-xs font-mono">
                  {statementData.party_type} ACCOUNT
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ID: #{statementData.party_id}
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1">
                {statementData.party_name}
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Standard Double-Entry Ledger Activity • Base Currency: USD
              </p>
            </div>

            {/* Financial Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 font-mono text-left sm:text-right bg-white/40 dark:bg-slate-800/40 p-3 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 block uppercase font-bold">Total Debits</span>
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  {formatUSD(totalDebits)}
                </span>
              </div>
              <div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 block uppercase font-bold">Total Credits</span>
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  {formatUSD(totalCredits)}
                </span>
              </div>
              <div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 block uppercase font-bold">Closing Balance</span>
                <span
                  className={`text-base sm:text-lg font-black ${
                    partyType === "transport" && closingBal < 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : closingBal >= 0
                      ? "text-sky-600 dark:text-sky-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {partyType === "transport" && closingBal < 0
                    ? `Credit: ${formatUSD(Math.abs(closingBal))}`
                    : formatUSD(closingBal)}
                </span>
                {partyType === "transport" && closingBal < 0 && (
                  <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-bold">
                    In AQ Companies Favor
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chronological Statement Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Chronological Statement Lines
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {lines.length} Records
          </span>
        </div>

        {/* Desktop Statement Table */}
        <div className="hidden md:block table-container shadow-2xs">
          <table className="table">
            <thead>
              <tr>
                <th className="w-28">Date</th>
                <th className="w-36">Reference</th>
                <th>Description / Particulars</th>
                <th className="text-right w-36">Debit (USD)</th>
                <th className="text-right w-36">Credit (USD)</th>
                <th className="text-right w-40">Running Balance (USD)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                    Generating statement...
                  </td>
                </tr>
              ) : lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                    No transactions found for this party.
                  </td>
                </tr>
              ) : (
                lines.map((l: any, idx: number) => (
                  <tr key={idx}>
                    <td className="font-mono text-xs text-slate-600 dark:text-slate-300">
                      {l.date}
                    </td>
                    <td className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                      {l.reference || "—"}
                    </td>
                    <td className="text-xs text-slate-800 dark:text-slate-200">
                      {l.description}
                    </td>
                    <td className="text-right font-mono text-xs">
                      {l.debit > 0 ? <MoneyDisplay amount={l.debit} /> : "—"}
                    </td>
                    <td className="text-right font-mono text-xs">
                      {l.credit > 0 ? <MoneyDisplay amount={l.credit} /> : "—"}
                    </td>
                    <td className="text-right font-mono text-xs">
                      <MoneyDisplay
                        amount={l.balance}
                        isCarrierCredit={partyType === "transport" && l.balance < 0}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-900 font-mono text-xs font-bold border-t-2 border-slate-200 dark:border-slate-700">
                  <td colSpan={3} className="text-right uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Total Activity & Closing Position:
                  </td>
                  <td className="text-right text-slate-900 dark:text-slate-100">
                    {formatUSD(totalDebits)}
                  </td>
                  <td className="text-right text-slate-900 dark:text-slate-100">
                    {formatUSD(totalCredits)}
                  </td>
                  <td
                    className={`text-right text-sm ${
                      partyType === "transport" && closingBal < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : closingBal >= 0
                        ? "text-sky-600 dark:text-sky-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {partyType === "transport" && closingBal < 0
                      ? `CR ${formatUSD(Math.abs(closingBal))}`
                      : formatUSD(closingBal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile Statement Cards (iPhone / Small Viewports) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-2.5">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Generating statement...
            </div>
          ) : lines.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No transactions found for this party.
            </div>
          ) : (
            lines.map((l: any, idx: number) => {
              const isCredit = (l.credit || 0) > 0;
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                    <span className="font-mono text-[11px] text-slate-500 font-medium">{l.date}</span>
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                      {l.reference || "N/A"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2">
                    {l.description || "Statement transaction"}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        {isCredit ? "Credit / Payment" : "Debit / Invoice"}
                      </span>
                      <span className={`font-black ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>
                        {isCredit ? `+${formatUSD(l.credit)}` : formatUSD(l.debit)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Running Balance
                      </span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {partyType === "transport" && l.balance < 0
                          ? `CR ${formatUSD(Math.abs(l.balance))}`
                          : formatUSD(l.balance)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
