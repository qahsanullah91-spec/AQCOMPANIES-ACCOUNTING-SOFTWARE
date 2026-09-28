"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Clock,
  UserCheck,
  FileText,
  RefreshCw,
  Eye,
  Check,
  X,
  FileCheck,
  Info,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface AccountingPeriod {
  id: number;
  period_name: string;
  start_date: string;
  end_date: string;
  status: "OPEN" | "CLOSED" | "LOCKED" | "REOPENED";
  closed_by: string | null;
  closed_at: string | null;
  notes: string | null;
}

interface ChecklistItem {
  item: string;
  passed: boolean;
  details: string;
  blocking: boolean;
}

interface ReadinessData {
  period_id: number;
  period_name: string;
  can_close: boolean;
  checklist: ChecklistItem[];
  pending_purchase_costs_count: number;
  warning: string | null;
}

export default function ClosePeriodControlCenterPage() {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<AccountingPeriod | null>(null);
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [closing, setClosing] = useState(false);
  const [userName, setUserName] = useState("Admin (Accountant)");
  const [notes, setNotes] = useState("");
  const [closeSuccess, setCloseSuccess] = useState<string | null>(null);

  const loadPeriods = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<AccountingPeriod[]>("/accounting/periods");
      setPeriods(res || []);
      const openOne = (res || []).find((p) => p.status === "OPEN" || p.status === "REOPENED");
      if (openOne) {
        setSelectedPeriod(openOne);
        runChecklist(openOne.id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runChecklist = async (periodId: number) => {
    setVerifying(true);
    setCloseSuccess(null);
    try {
      const res = await fetchApi<ReadinessData>(`/accounting/periods/${periodId}/readiness`);
      setReadiness(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    loadPeriods();
  }, []);

  const handlePeriodChange = (periodId: number) => {
    const p = periods.find((x) => x.id === periodId) || null;
    setSelectedPeriod(p);
    if (p) runChecklist(p.id);
  };

  const executeClose = async () => {
    if (!selectedPeriod) return;
    setClosing(true);
    try {
      const res: any = await fetchApi(`/accounting/periods/${selectedPeriod.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: userName,
          notes: notes || "Month-end closing checklist completed and validated.",
        }),
      });
      setCloseSuccess(`Period ${selectedPeriod.period_name} successfully CLOSED. 4 immutable financial snapshots stored with SHA256 cryptographic checksums.`);
      loadPeriods();
    } catch (err: any) {
      alert(err.message || "Failed to close period.");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
      <AccountingNav />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link href="/accounting/periods" className="hover:text-sky-600 flex items-center space-x-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Accounting Periods</span>
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Month-End Close Checklist</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Month-End Closing Control Center</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Section 16 Pre-Closing Verification: GL balance, bank reconciliations, cash counts, Sarafi & immutable snapshots.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod?.id || ""}
            onChange={(e) => handlePeriodChange(Number(e.target.value))}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.period_name} ({p.status})
              </option>
            ))}
          </select>

          <button
            onClick={() => selectedPeriod && runChecklist(selectedPeriod.id)}
            disabled={verifying}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifying ? "animate-spin" : ""}`} />
            <span>Re-Verify Checklist</span>
          </button>
        </div>
      </div>

      {closeSuccess && (
        <div className="my-6 p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 flex items-start space-x-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-sm block mb-0.5">MONTH-END CLOSE COMPLETE</span>
            <p>{closeSuccess}</p>
          </div>
        </div>
      )}

      {/* Checklist Verification Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 my-6">
        {/* Left 2 Cols: Checklist */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Pre-Close Verification Checklist for {selectedPeriod?.period_name || "Period"}
            </h2>
            <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
              readiness?.can_close
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
            }`}>
              {readiness?.can_close ? "ELIGIBLE FOR CLOSING" : "BLOCKING ITEMS OUTSTANDING"}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {readiness?.checklist.map((item, idx) => (
              <div key={idx} className="p-4 flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`p-1.5 rounded-lg mt-0.5 ${
                    item.passed ? "bg-emerald-100 text-emerald-700" : item.blocking ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {item.passed ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 block">
                      {item.item}
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5 block">{item.details}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                    item.passed
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : item.blocking
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}>
                    {item.passed ? "PASSED" : item.blocking ? "BLOCKING" : "WARNING"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Closing Action Box */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Lock className="w-5 h-5 text-amber-600" />
              <span>Execute Month-End Close</span>
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              Closing this period will lock normal postings for {selectedPeriod?.start_date} to {selectedPeriod?.end_date} and generate 4 immutable snapshots (Trial Balance, P&L, Balance Sheet, Cash Flow) secured with SHA256 checksums.
            </p>

            <div className="space-y-3 text-xs pt-2">
              <div>
                <label className="block font-semibold mb-1">Authorized Closing Accountant:</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Closing Audit Notes:</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Trial balance verified at $0.00 difference. 63 shipments flagged with pending Afghan costs."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <button
                onClick={executeClose}
                disabled={!readiness?.can_close || closing || selectedPeriod?.status === "CLOSED" || selectedPeriod?.status === "LOCKED"}
                className={`w-full py-2.5 text-xs font-bold rounded-xl text-white shadow-xs transition-colors flex items-center justify-center space-x-2 ${
                  readiness?.can_close && selectedPeriod?.status !== "CLOSED" && selectedPeriod?.status !== "LOCKED"
                    ? "bg-amber-600 hover:bg-amber-500 cursor-pointer"
                    : "bg-slate-400 dark:bg-slate-700 cursor-not-allowed"
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>{closing ? "Generating Snapshots & Closing..." : `Close Period: ${selectedPeriod?.period_name || ""}`}</span>
              </button>
            </div>
          </div>

          {/* Section 17 Incomplete Costs Notice */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-500 space-y-1">
            <span className="font-bold text-slate-700 dark:text-slate-300 block">Section 17 Purchase Cost Rule</span>
            <p>
              Missing supplier purchase costs do NOT block bank closing. The 63 shipments with pending costs are clearly quarantined in financial reports as Preliminary.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
