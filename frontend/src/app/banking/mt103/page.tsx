"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Receipt,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Upload,
  Search,
  ExternalLink,
  Clock,
  ArrowRight,
  Check,
  Building2,
  Landmark,
  Layers,
  Copy,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { BankingNav } from "@/components/BankingNav";

interface MT103Record {
  id: number;
  transaction_reference: string;
  value_date: string;
  currency: string;
  amount: number;
  ordering_customer?: string;
  beneficiary?: string;
  beneficiary_account?: string;
  remittance_info?: string;
  charges_details?: string;
  status: string;
  linked_bank_transaction_id?: number;
  linked_invoice_id?: number;
  linked_customer_id?: number;
  raw_mt103: string;
  created_at: string;
}

const SAMPLE_MT103 = `:20:FT26269001928374
:23B:CRED
:32A:260926USD74750,00
:50K:G.T JAYANTI AGROCHEM INDIA PVT LTD
AHMEDABAD, GUJARAT, INDIA
:53A:HDFCINBBXXX
:57A:AFUNAFK1XXX
:59:/AF38AFUN00000000129482
AQ COMPANIES
KABUL, AFGHANISTAN
:70:SETTLEMENT OF COMMERCIAL INVOICE INV-01
DRIED FIGS SHIPMENT
:71A:OUR`;

export default function SwiftMT103Page() {
  const [records, setRecords] = useState<MT103Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<any | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<MT103Record | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    try {
      setLoading(true);
      const data = await fetchApi<MT103Record[]>("/accounting/mt103/records");
      setRecords(data);
    } catch (err: any) {
      console.error("Failed to load MT103 records", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleParseAndRecord() {
    if (!rawText.trim()) {
      setErrorMessage("Please paste a SWIFT MT103 message.");
      return;
    }

    try {
      setParsing(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await fetchApi<any>("/accounting/mt103/parse-and-record", {
        method: "POST",
        body: JSON.stringify({
          raw_mt103_text: rawText,
          notes: "Imported via Web Center",
        }),
      });

      setSuccessMessage(
        `Successfully recorded MT103 Reference ${res.transaction_reference} for ${formatUSD(res.amount)} ${res.currency}.`
      );
      setParseResult(res);
      setRawText("");
      loadRecords();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to parse MT103 message.");
    } finally {
      setParsing(false);
    }
  }

  function loadSample() {
    setRawText(SAMPLE_MT103);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Receipt className="w-7 h-7 text-sky-600" />
            SWIFT MT103 Parser & Wire Payment Tracker
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Standard SWIFT MT103 Wire Parsing • Remittance Extraction • Pipeline Verification
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link href="/banking/import" className="btn btn-secondary text-xs font-bold">
            Statement Import
          </Link>
          <Link href="/banking/reconciliation" className="btn btn-primary text-xs font-bold">
            Reconciliation Workspace
          </Link>
        </div>
      </div>

      <BankingNav />

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-3 text-emerald-800 dark:text-emerald-200 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-center space-x-3 text-rose-800 dark:text-rose-200 text-sm font-semibold">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Textarea */}
        <div className="lg:col-span-2 card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-600" />
              Paste SWIFT MT103 Message or Wire Advice
            </h2>
            <button
              onClick={loadSample}
              className="text-xs text-sky-600 hover:text-sky-700 font-bold"
            >
              Load Sample MT103
            </button>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={10}
            placeholder={`:20:FT26269001928374\n:23B:CRED\n:32A:260926USD74750,00\n:50K:CUSTOMER NAME...\n:59:AQ COMPANIES\n:70:INV-01 SETTLEMENT...`}
            className="input w-full font-mono text-xs p-3 leading-relaxed"
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Parses tags: :20: (Ref), :32A: (Date/Cur/Amt), :50: (Ordering), :59: (Beneficiary), :70: (Invoice/Remittance)
            </span>
            <button
              onClick={handleParseAndRecord}
              disabled={parsing || !rawText.trim()}
              className="btn btn-primary text-xs font-black py-2.5 px-6 flex items-center space-x-2"
            >
              {parsing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Parsing & Linking...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Parse & Record Wire</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: SWIFT MT103 Status Guide */}
        <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            SWIFT Wire Lifecycle Pipeline
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                1. PAYMENT ADVISED
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Customer informs wire sent; awaits MT103 copy.
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40">
              <div className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                2. MT103 RECEIVED
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                SWIFT proof authenticated; pending bank credit in AUB statement.
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
              <div className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                3. BANK CREDIT CONFIRMED
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Funds physically received in bank statement.
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
              <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                4. ALLOCATED & RECONCILED
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Posted to Customer Subledger & GL Cash Account (Debit 1000 / Credit 1100).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recorded MT103 Table */}
      <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span>Recorded SWIFT MT103 Records ({records.length})</span>
          </h2>
          <button
            onClick={loadRecords}
            className="btn btn-secondary text-xs flex items-center space-x-1 py-1 px-2.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-3 px-4">Ref (:20:)</th>
                <th className="py-3 px-4">Value Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Ordering Customer (:50:)</th>
                <th className="py-3 px-4">Beneficiary (:59:)</th>
                <th className="py-3 px-4">Remittance (:70:)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No MT103 records recorded yet. Paste a SWIFT message above to register.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                      {rec.transaction_reference}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {rec.value_date}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                      +{formatUSD(rec.amount)} {rec.currency}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-800 dark:text-slate-200 font-semibold">
                      {rec.ordering_customer || "—"}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400">
                      {rec.beneficiary || "AQ COMPANIES"}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-500">
                      {rec.remittance_info || "—"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`badge text-[10px] ${
                          rec.status === "RECONCILED" || rec.status === "ALLOCATED"
                            ? "badge-emerald"
                            : rec.status === "BANK CREDIT CONFIRMED"
                            ? "badge-purple"
                            : "badge-sky"
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setViewingRecord(rec)}
                        className="btn btn-secondary text-xs font-bold py-1 px-2.5"
                      >
                        View Raw →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw MT103 Viewer Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-sky-600" />
                SWIFT MT103: {viewingRecord.transaction_reference}
              </h3>
              <button
                onClick={() => setViewingRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Amount & Date</div>
                <div className="text-base font-black text-emerald-600 mt-0.5">
                  {formatUSD(viewingRecord.amount)} {viewingRecord.currency}
                </div>
                <div className="text-slate-500 text-[11px]">Value Date: {viewingRecord.value_date}</div>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Lifecycle Status</div>
                <div className="mt-1">
                  <span className="badge badge-sky text-xs font-bold">{viewingRecord.status}</span>
                </div>
                <div className="text-slate-500 text-[11px] mt-1">Charges: {viewingRecord.charges_details || "OUR"}</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Raw SWIFT MT103 Text
              </div>
              <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-60 leading-relaxed border border-slate-800">
                {viewingRecord.raw_mt103}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setViewingRecord(null)}
                className="btn btn-secondary text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
