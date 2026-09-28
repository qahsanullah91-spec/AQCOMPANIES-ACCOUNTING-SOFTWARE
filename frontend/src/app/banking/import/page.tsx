"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Building2,
  Truck,
  Landmark,
  Scale,
  Receipt,
  FileSpreadsheet,
  Check,
  ChevronRight,
  HelpCircle,
  Clock,
  Layers,
  Search,
} from "lucide-react";
import { fetchApi, formatUSD, API_BASE } from "@/lib/api";
import { BankingNav } from "@/components/BankingNav";

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  currency: string;
  current_balance: number;
}

interface StatementPreviewRow {
  row_index: number;
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance?: number;
  is_duplicate: boolean;
  duplicate_reason?: string;
  match_status: string;
  confidence_score: number;
  matching_reasons: string[];
  suggested_type?: string;
  suggested_party_type?: string;
  suggested_party_id?: number;
  suggested_party_name?: string;
  suggested_invoice_id?: number;
  suggested_invoice_number?: string;
  allocations_plan?: any[];
  raw_source_data?: string;
}

interface ImportPreviewData {
  is_duplicate_file: boolean;
  file_name: string;
  file_hash: string;
  bank_account_id: number;
  bank_name: string;
  currency: string;
  total_rows: number;
  total_money_in: number;
  total_money_out: number;
  duplicate_rows_detected: number;
  rows: StatementPreviewRow[];
  error?: string;
}

interface ImportBatch {
  id: number;
  batch_number: string;
  bank_account_id: number;
  bank_name?: string;
  currency?: string;
  file_name: string;
  file_hash: string;
  statement_start_date: string;
  statement_end_date: string;
  total_rows: number;
  matched_rows: number;
  status: string;
  uploaded_by: string;
  uploaded_at: string;
  notes?: string;
}

export default function BankStatementImportPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [activeTab, setActiveTab] = useState<"upload" | "batches" | "rules">("upload");
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Match Confirmation Drawer State
  const [activeBatch, setActiveBatch] = useState<any | null>(null);
  const [selectedLineForMatch, setSelectedLineForMatch] = useState<any | null>(null);
  const [matchActionType, setMatchActionType] = useState<string>("AUTO");
  const [actionNotes, setActionNotes] = useState<string>("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadBankAccounts();
    loadBatches();
  }, []);

  async function loadBankAccounts() {
    try {
      const data = await fetchApi<BankAccount[]>("/accounting/banks");
      setBankAccounts(data);
      if (data.length > 0 && !selectedBankId) {
        setSelectedBankId(data[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load bank accounts", err);
    }
  }

  async function loadBatches() {
    try {
      const data = await fetchApi<ImportBatch[]>("/accounting/bank-import/batches");
      setBatches(data);
    } catch (err: any) {
      console.error("Failed to load batches", err);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewData(null);
      setCommitMessage(null);
      setErrorMessage(null);
    }
  }

  async function handlePreviewUpload() {
    if (!file || !selectedBankId) {
      setErrorMessage("Please select a bank account and a statement file.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setCommitMessage(null);

      const formData = new FormData();
      formData.append("bank_account_id", selectedBankId.toString());
      formData.append("file", file);

      // Raw fetch for multipart upload
      const res = await fetch(`${API_BASE}/accounting/bank-import/preview`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Upload preview failed");
      }

      const data: ImportPreviewData = await res.json();
      setPreviewData(data);
      if (data.is_duplicate_file) {
        setErrorMessage(data.error || "This file has already been imported!");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process bank statement.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommitBatch() {
    if (!previewData || previewData.is_duplicate_file) return;

    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetchApi<any>("/accounting/bank-import/commit", {
        method: "POST",
        body: JSON.stringify({
          bank_account_id: previewData.bank_account_id,
          file_name: previewData.file_name,
          file_hash: previewData.file_hash,
          rows: previewData.rows,
          notes: `Imported via Web Center on ${new Date().toLocaleDateString()}`,
        }),
      });

      setCommitMessage(`Successfully committed batch ${res.batch_number} with ${res.total_rows} staged lines.`);
      setPreviewData(null);
      setFile(null);
      loadBatches();
      setActiveTab("batches");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to commit statement batch.");
    } finally {
      setLoading(false);
    }
  }

  async function openBatchReview(batchId: number) {
    try {
      setLoading(true);
      const b = await fetchApi<any>(`/accounting/bank-import/batches/${batchId}`);
      setActiveBatch(b);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load batch lines.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmMatch() {
    if (!selectedLineForMatch) return;

    try {
      setConfirming(true);
      const action = matchActionType === "AUTO" ? selectedLineForMatch.suggested_type : matchActionType;
      const res = await fetchApi<any>("/accounting/bank-matching/confirm", {
        method: "POST",
        body: JSON.stringify({
          statement_line_id: selectedLineForMatch.id,
          action_type: action,
          party_id: selectedLineForMatch.suggested_party_id,
          party_name: selectedLineForMatch.suggested_party_name,
          invoice_id: selectedLineForMatch.suggested_invoice_id,
          custom_allocations: selectedLineForMatch.allocations_plan,
          notes: actionNotes || selectedLineForMatch.description,
        }),
      });

      // Update line in activeBatch
      if (activeBatch) {
        setActiveBatch({
          ...activeBatch,
          statement_lines: activeBatch.statement_lines.map((l: any) =>
            l.id === selectedLineForMatch.id
              ? { ...l, match_status: "MATCHED", matched_transaction_id: res.bank_transaction_id }
              : l
          ),
        });
      }
      setSelectedLineForMatch(null);
      loadBatches();
    } catch (err: any) {
      alert("Error confirming match: " + err.message);
    } finally {
      setConfirming(false);
    }
  }

  const selectedBank = bankAccounts.find((b) => b.id === Number(selectedBankId));

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <UploadCloud className="w-7 h-7 text-emerald-600" />
            Bank Statement Import & Reconciliation Engine
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • SHA-256 Duplicate Protection • Intelligent Scoring Model • Atomic Double-Entry Posting
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link href="/banking/unmatched" className="btn btn-secondary text-xs font-bold">
            Unmatched Queue
          </Link>
          <Link href="/banking/reconciliation" className="btn btn-primary text-xs font-bold">
            Reconciliation Workspace
          </Link>
        </div>
      </div>

      <BankingNav />

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-sm font-semibold space-x-6">
        <button
          onClick={() => setActiveTab("upload")}
          className={`pb-3 flex items-center space-x-2 transition-colors ${
            activeTab === "upload"
              ? "border-b-2 border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload & Intelligent Preview</span>
        </button>
        <button
          onClick={() => setActiveTab("batches")}
          className={`pb-3 flex items-center space-x-2 transition-colors ${
            activeTab === "batches"
              ? "border-b-2 border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Staged Import Batches ({batches.length})</span>
        </button>
      </div>

      {commitMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-3 text-emerald-800 dark:text-emerald-200 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{commitMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-center space-x-3 text-rose-800 dark:text-rose-200 text-sm font-semibold">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: UPLOAD & PREVIEW */}
      {activeTab === "upload" && (
        <div className="space-y-6">
          {/* Upload Configuration Card */}
          <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Upload Bank Statement (CSV / JSON / TXT)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Bank Account
                </label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(Number(e.target.value))}
                  className="input w-full text-xs font-semibold"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} ({b.currency}) • Bal: {formatUSD(b.current_balance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Statement File
                </label>
                <input
                  type="file"
                  accept=".csv,.json,.txt"
                  onChange={handleFileSelect}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 text-xs text-slate-500 cursor-pointer w-full border border-slate-200 dark:border-slate-800 rounded-lg p-1.5"
                />
              </div>

              <div>
                <button
                  onClick={handlePreviewUpload}
                  disabled={loading || !file}
                  className="btn btn-primary w-full text-xs font-bold py-2.5 flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Parsing & Classifying...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Parse & Auto-Score Matches</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                SHA-256 duplicate file block
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-sky-600" />
                Auto-matches Customer Invoices (+50)
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-purple-600" />
                Sky Ariana Transport Wires (+99)
              </span>
              <span className="flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-amber-600" />
                Bank Fees Account 5600 (+45)
              </span>
            </div>
          </div>

          {/* Preview Results Panel */}
          {previewData && (
            <div className="space-y-4">
              {/* Batch Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Rows</div>
                  <div className="text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">
                    {previewData.total_rows}
                  </div>
                </div>

                <div className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Money In</div>
                  <div className="text-lg font-black text-emerald-600 mt-0.5">
                    +{formatUSD(previewData.total_money_in)}
                  </div>
                </div>

                <div className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Money Out</div>
                  <div className="text-lg font-black text-rose-600 mt-0.5">
                    -{formatUSD(previewData.total_money_out)}
                  </div>
                </div>

                <div className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Duplicate Rows</div>
                  <div className="text-lg font-black text-amber-600 mt-0.5">
                    {previewData.duplicate_rows_detected}
                  </div>
                </div>

                <div className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center">
                  <button
                    onClick={handleCommitBatch}
                    disabled={loading || previewData.is_duplicate_file}
                    className="btn btn-primary w-full text-xs font-black py-2"
                  >
                    Commit Staged Batch →
                  </button>
                </div>
              </div>

              {/* Parsed & Scored Statement Rows Table */}
              <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Intelligent Statement Classification & Match Proposals
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    File Hash: {previewData.file_hash.substring(0, 16)}...
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Description & Reference</th>
                        <th className="py-2.5 px-3 text-right">Debit (Out)</th>
                        <th className="py-2.5 px-3 text-right">Credit (In)</th>
                        <th className="py-2.5 px-3 text-center">Score</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Suggested Match & Rationale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {previewData.rows.map((row, idx) => {
                        const isMatch = row.confidence_score >= 80;
                        const isPossible = row.confidence_score >= 35 && row.confidence_score < 80;

                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                              row.is_duplicate ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                            }`}
                          >
                            <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                              {row.date}
                            </td>
                            <td className="py-3 px-3 max-w-xs">
                              <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                {row.description}
                              </div>
                              {row.reference && (
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  Ref: {row.reference}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                              {row.debit > 0 ? `-${formatUSD(row.debit)}` : "—"}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                              {row.credit > 0 ? `+${formatUSD(row.credit)}` : "—"}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black font-mono ${
                                  row.confidence_score >= 90
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : row.confidence_score >= 60
                                    ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                                    : row.confidence_score >= 30
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {row.confidence_score}%
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {row.is_duplicate ? (
                                <span className="badge badge-amber text-[10px]">
                                  PROBABLE DUPLICATE
                                </span>
                              ) : row.match_status === "EXACT_MATCH" ? (
                                <span className="badge badge-emerald text-[10px]">
                                  EXACT MATCH
                                </span>
                              ) : row.match_status === "HIGH_CONFIDENCE" ? (
                                <span className="badge badge-sky text-[10px]">
                                  HIGH CONFIDENCE
                                </span>
                              ) : row.match_status === "POSSIBLE_MATCH" ? (
                                <span className="badge badge-amber text-[10px]">
                                  POSSIBLE MATCH
                                </span>
                              ) : (
                                <span className="badge badge-slate text-[10px]">
                                  UNMATCHED
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div className="text-xs">
                                {row.suggested_party_name && (
                                  <div className="font-bold text-slate-800 dark:text-slate-200">
                                    {row.suggested_party_name}
                                    {row.suggested_invoice_number && (
                                      <span className="ml-1 text-[11px] text-sky-600 dark:text-sky-400 font-mono">
                                        ({row.suggested_invoice_number})
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {row.matching_reasons && row.matching_reasons.length > 0
                                    ? row.matching_reasons.join(" • ")
                                    : "No matching ledger records found."}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STAGED IMPORT BATCHES */}
      {activeTab === "batches" && (
        <div className="space-y-6">
          <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Staged Bank Import Batches
              </h2>
              <button
                onClick={loadBatches}
                className="btn btn-secondary text-xs flex items-center space-x-1.5 py-1 px-2.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4">Bank Account</th>
                    <th className="py-3 px-4">File Name</th>
                    <th className="py-3 px-4 text-center">Lines</th>
                    <th className="py-3 px-4 text-center">Matched</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Uploaded</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No import batches found. Upload a statement to get started.
                      </td>
                    </tr>
                  ) : (
                    batches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                          {b.batch_number}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {b.bank_name || `Account #${b.bank_account_id}`}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 truncate max-w-xs">
                          {b.file_name}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          {b.total_rows}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">
                          {b.matched_rows}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`badge text-[10px] ${
                              b.status === "POSTED" || b.status === "RECONCILED"
                                ? "badge-emerald"
                                : b.status === "READY_FOR_REVIEW"
                                ? "badge-sky"
                                : "badge-amber"
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(b.uploaded_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openBatchReview(b.id)}
                            className="btn btn-secondary text-xs font-bold py-1 px-3"
                          >
                            Review Lines →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Batch Lines Detailed Review */}
          {activeBatch && (
            <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm space-y-4 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Batch Review: {activeBatch.batch_number}</span>
                    <span className="badge badge-sky text-xs">{activeBatch.status}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeBatch.file_name} • {activeBatch.total_rows} total statement lines staged for posting
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveBatch(null)}
                    className="btn btn-secondary text-xs"
                  >
                    Close Review
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Confidence</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Proposed Action</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {activeBatch.statement_lines?.map((line: any) => (
                      <tr key={line.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {line.transaction_date || line.date}
                        </td>
                        <td className="py-2.5 px-3 max-w-xs">
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {line.description}
                          </div>
                          {line.reference && (
                            <div className="text-[10px] font-mono text-slate-400">
                              Ref: {line.reference}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {line.credit > 0 ? (
                            <span className="text-emerald-600">+{formatUSD(line.credit)}</span>
                          ) : (
                            <span className="text-rose-600">-{formatUSD(line.debit)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                            {line.confidence_score}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`badge text-[10px] ${
                              line.match_status === "MATCHED" || line.match_status === "RECONCILED"
                                ? "badge-emerald"
                                : line.match_status === "EXACT_MATCH"
                                ? "badge-sky"
                                : line.match_status === "HIGH_CONFIDENCE"
                                ? "badge-sky"
                                : "badge-slate"
                            }`}
                          >
                            {line.match_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {line.suggested_type?.replace(/_/g, " ") || "UNCLASSIFIED"}
                          </div>
                          {line.suggested_party_name && (
                            <div className="text-[11px] text-slate-500">
                              {line.suggested_party_name}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {line.match_status === "MATCHED" ? (
                            <span className="text-emerald-600 font-bold text-xs flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Posted
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedLineForMatch(line);
                                setMatchActionType(line.suggested_type || "CUSTOMER_RECEIPT");
                              }}
                              className="btn btn-primary text-xs py-1 px-2.5 font-bold"
                            >
                              Confirm Match →
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION DRAWER / MODAL */}
      {selectedLineForMatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Confirm & Atomically Post Transaction
              </h3>
              <button
                onClick={() => setSelectedLineForMatch(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Description:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-right">
                  {selectedLineForMatch.description}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reference:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {selectedLineForMatch.reference || "None"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  {selectedLineForMatch.credit > 0
                    ? `+${formatUSD(selectedLineForMatch.credit)} (Incoming)`
                    : `-${formatUSD(selectedLineForMatch.debit)} (Outgoing)`}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Accounting Action Type
                </label>
                <select
                  value={matchActionType}
                  onChange={(e) => setMatchActionType(e.target.value)}
                  className="input w-full text-xs font-semibold"
                >
                  <option value="CUSTOMER_RECEIPT">Customer Receipt (Auto-allocate to Open Invoices / Advance 2150)</option>
                  <option value="TRANSPORT_PAYMENT">Transport Payment (Sky Ariana Limited)</option>
                  <option value="BANK_CHARGE">Bank Charge / Fee (Account 5600)</option>
                  <option value="SUPPLIER_PAYMENT">Supplier Payment</option>
                  <option value="UNIDENTIFIED_SUSPENSE">Unidentified Wire → Suspense Account (1090)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Audit Notes / Reference Override
                </label>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="e.g. Verified by finance manager against wire slip"
                  className="input w-full text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSelectedLineForMatch(null)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMatch}
                disabled={confirming}
                className="btn btn-primary text-xs font-bold flex items-center space-x-1.5"
              >
                {confirming ? (
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
