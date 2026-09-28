"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Scale,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Check,
  Layers,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  HelpCircle,
  Building2,
  Truck,
  Landmark,
  Receipt,
  UserCheck,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { BankingNav } from "@/components/BankingNav";

interface UnmatchedLine {
  id: number;
  batch_id?: number;
  bank_account_id?: number;
  bank_name?: string;
  transaction_date: string;
  description: string;
  reference?: string;
  currency: string;
  debit: number;
  credit: number;
  normalized_amount: number;
  match_status: string;
  confidence_score: number;
  matching_reasons: string[];
  suggested_type?: string;
  suggested_party_type?: string;
  suggested_party_id?: number;
  suggested_party_name?: string;
  suggested_invoice_id?: number;
  suggested_invoice_number?: string;
}

export default function UnmatchedPaymentQueuePage() {
  const [lines, setLines] = useState<UnmatchedLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDirection, setFilterDirection] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [minConfidence, setMinConfidence] = useState<number>(0);

  // Modal / Drawer state for manual allocation
  const [activeLine, setActiveLine] = useState<UnmatchedLine | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>("CUSTOMER_RECEIPT");
  const [overrideNotes, setOverrideNotes] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    try {
      setLoading(true);
      const data = await fetchApi<UnmatchedLine[]>("/accounting/unmatched-queue");
      setLines(data);
    } catch (err: any) {
      console.error("Failed to load unmatched queue", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPosting(line: UnmatchedLine, actionType: string) {
    try {
      setProcessing(true);
      const res = await fetchApi<any>("/accounting/bank-matching/confirm", {
        method: "POST",
        body: JSON.stringify({
          statement_line_id: line.id,
          action_type: actionType,
          party_id: line.suggested_party_id,
          party_name: line.suggested_party_name,
          invoice_id: line.suggested_invoice_id,
          notes: overrideNotes || `Matched via Unmatched Queue on ${new Date().toLocaleDateString()}`,
        }),
      });

      setSuccessNotice(`Successfully posted ${res.transaction_code} (${actionType}) to General Ledger.`);
      setActiveLine(null);
      setOverrideNotes("");
      loadQueue();
    } catch (err: any) {
      alert("Error confirming transaction: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  function handleConfirmAutoMatch(line: UnmatchedLine) {
    return handleConfirmPosting(line, line.suggested_type || "CUSTOMER_RECEIPT");
  }

  // Filtered rows
  const filteredLines = lines.filter((l) => {
    if (filterDirection === "IN" && l.credit <= 0) return false;
    if (filterDirection === "OUT" && l.debit <= 0) return false;
    if (l.confidence_score < minConfidence) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const desc = (l.description || "").toLowerCase();
      const ref = (l.reference || "").toLowerCase();
      const party = (l.suggested_party_name || "").toLowerCase();
      return desc.includes(q) || ref.includes(q) || party.includes(q);
    }
    return true;
  });

  const totalInflow = lines.filter((l) => l.credit > 0).reduce((acc, l) => acc + l.credit, 0);
  const totalOutflow = lines.filter((l) => l.debit > 0).reduce((acc, l) => acc + l.debit, 0);
  const highConfidenceCount = lines.filter((l) => l.confidence_score >= 60).length;

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Scale className="w-7 h-7 text-amber-600" />
            Unmatched Payment & Receipt Queue
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Staged Bank Lines Awaiting Identification, Allocation, or Reconciliation Approval
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link href="/banking/import" className="btn btn-secondary text-xs font-bold">
            + Import Statement
          </Link>
          <button
            onClick={loadQueue}
            disabled={loading}
            className="btn btn-primary text-xs font-bold flex items-center space-x-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      <BankingNav />

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-3 text-emerald-800 dark:text-emerald-200 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unmatched Items</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {lines.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Staged across all accounts</div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Inflows (Receipts)</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            +{formatUSD(totalInflow)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Customer payments / wires</div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Outflows (Debits)</div>
          <div className="text-2xl font-black text-rose-600 mt-1">
            -{formatUSD(totalOutflow)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Freight, fees & supplier wires</div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">High Confidence Matches</div>
          <div className="text-2xl font-black text-sky-600 mt-1">
            {highConfidenceCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Ready for 1-click confirmation</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500">Direction:</span>
          {(["ALL", "IN", "OUT"] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => setFilterDirection(dir)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filterDirection === dir
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {dir === "ALL" ? "All Lines" : dir === "IN" ? "Money In (+)" : "Money Out (-)"}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, reference, party..."
              className="input pl-8 py-1.5 text-xs w-64"
            />
          </div>

          <select
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="input py-1.5 text-xs font-semibold"
          >
            <option value="0">All Confidence Levels</option>
            <option value="50">Confidence ≥ 50%</option>
            <option value="70">Confidence ≥ 70%</option>
            <option value="90">Exact Matches Only (≥90%)</option>
          </select>
        </div>
      </div>

      {/* Unmatched Lines Table */}
      <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span>Staged Unmatched Items ({filteredLines.length})</span>
          </h2>
          <span className="text-[11px] text-slate-500">
            Click &quot;Confirm Match&quot; to atomically post to General Ledger & Subledgers
          </span>
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Bank Account</th>
                <th className="py-3 px-4">Description & Reference</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Score</th>
                <th className="py-3 px-4">Suggested Allocation</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No unmatched bank statement lines in this queue. Everything is reconciled!
                  </td>
                </tr>
              ) : (
                filteredLines.map((line) => {
                  const isCredit = line.credit > 0;
                  const amt = isCredit ? line.credit : line.debit;

                  return (
                    <tr key={line.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {line.transaction_date}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {line.bank_name || `Account #${line.bank_account_id}`}
                      </td>
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {line.description}
                        </div>
                        {line.reference && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            Ref: {line.reference}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        {isCredit ? (
                          <span className="text-emerald-600">+{formatUSD(amt)}</span>
                        ) : (
                          <span className="text-rose-600">-{formatUSD(amt)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black font-mono ${
                            line.confidence_score >= 90
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : line.confidence_score >= 60
                              ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                              : line.confidence_score >= 30
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {line.confidence_score}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {line.suggested_type?.replace(/_/g, " ") || "UNKNOWN"}
                          </span>
                          {line.suggested_party_name && (
                            <span className="ml-1 text-sky-600 dark:text-sky-400 font-semibold">
                              ({line.suggested_party_name})
                            </span>
                          )}
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {line.matching_reasons?.join(" • ") || "Awaiting manual assignment"}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {line.confidence_score >= 80 ? (
                          <button
                            onClick={() => handleConfirmPosting(line, line.suggested_type || "CUSTOMER_RECEIPT")}
                            disabled={processing}
                            className="btn btn-primary text-xs font-bold py-1 px-3"
                          >
                            Quick Post →
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveLine(line);
                              setSelectedAction(line.suggested_type || "CUSTOMER_RECEIPT");
                            }}
                            className="btn btn-secondary text-xs font-bold py-1 px-3"
                          >
                            Allocate / Post →
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (< md) (Req 22, 23, 24) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-3">
          {filteredLines.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No unmatched bank statement lines in this queue. Everything is reconciled!
            </div>
          ) : (
            filteredLines.map((line) => {
              const isCredit = line.credit > 0;
              const amt = isCredit ? line.credit : line.debit;

              return (
                <div
                  key={line.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 block">
                        {line.transaction_date} • {line.bank_name || "Bank Account"}
                      </span>
                      <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100 mt-0.5">
                        {line.description}
                      </h3>
                      {line.reference && (
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                          Ref: {line.reference}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-base font-black font-mono ${
                          isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isCredit ? "+" : "-"}{formatUSD(amt)}
                      </span>
                      <span className="block text-[9px] uppercase font-bold text-slate-400 mt-0.5">
                        {isCredit ? "Credit / Inflow" : "Debit / Outflow"}
                      </span>
                    </div>
                  </div>

                  {/* Possible Match Card (Req 22) */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Suggested Match</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          line.confidence_score >= 80
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                        }`}
                      >
                        {line.confidence_score >= 80 ? "HIGH CONFIDENCE" : "POSSIBLE MATCH"} ({line.confidence_score}%)
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                      <span>{line.suggested_party_name || "Trade Counterparty"}</span>
                      <span className="text-slate-500 font-semibold text-[11px]">
                        {line.suggested_type?.replace(/_/g, " ")}
                      </span>
                    </div>

                    {line.matching_reasons && line.matching_reasons.length > 0 && (
                      <div className="text-[10px] text-slate-500 flex flex-wrap gap-1.5 pt-0.5">
                        {line.matching_reasons.map((r, i) => (
                          <span key={i} className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            ✓ {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions: MATCH, CHOOSE ANOTHER, LEAVE UNMATCHED (Req 22, 23) */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleConfirmAutoMatch(line)}
                      disabled={processing}
                      className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>MATCH</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveLine(line);
                        setSelectedAction(line.suggested_type || "CUSTOMER_RECEIPT");
                      }}
                      className="py-2.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-[11px] font-bold flex items-center justify-center active:scale-95"
                    >
                      <span>CHOOSE</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLines((prev) => prev.filter((l) => l.id !== line.id));
                      }}
                      className="py-2.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 text-[11px] font-semibold flex items-center justify-center active:scale-95"
                    >
                      <span>LEAVE</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manual Allocation Drawer */}
      {activeLine && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                Allocate Bank Statement Line
              </h3>
              <button
                onClick={() => setActiveLine(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{activeLine.transaction_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Description:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-right">{activeLine.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  {activeLine.credit > 0 ? `+${formatUSD(activeLine.credit)}` : `-${formatUSD(activeLine.debit)}`}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Account & Posting Rule
                </label>
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="input w-full text-xs font-semibold"
                >
                  <option value="CUSTOMER_RECEIPT">
                    Customer Receipt (Settles oldest open invoices, excess to Advance 2150)
                  </option>
                  <option value="CUSTOMER_ADVANCE">
                    Customer Advance (Credited directly to Account 2150)
                  </option>
                  <option value="UNIDENTIFIED_SUSPENSE">
                    Unidentified Receipt / Suspense (Credited to Account 1090)
                  </option>
                  <option value="TRANSPORT_PAYMENT">
                    Transport Freight Payment (Credited to Sky Ariana carrier ledger)
                  </option>
                  <option value="BANK_CHARGE">
                    Bank Fee / Commission (Debited to Account 5600 Bank Charges)
                  </option>
                  <option value="SUPPLIER_PAYMENT">
                    Supplier Payment / Sourcing Advance (Debited to Account 1350)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Audit Rationale / Notes
                </label>
                <input
                  type="text"
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="e.g. Wire confirmed by finance team against SWIFT copy"
                  className="input w-full text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveLine(null)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmPosting(activeLine, selectedAction)}
                disabled={processing}
                className="btn btn-primary text-xs font-bold flex items-center space-x-1.5"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Posting to Ledger...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Post Double-Entry Journal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
