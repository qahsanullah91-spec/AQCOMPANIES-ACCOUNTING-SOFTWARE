"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Scale,
  Users,
  Building2,
  Truck,
  Landmark,
  Wallet,
  ArrowRightLeft,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { fetchApi, formatUSD } from "@/lib/api";

interface DiagnosticItem {
  module: string;
  status: "BALANCED" | "ERROR";
  difference: number;
  details: string;
  action: string;
  mismatches?: Array<{ customer: string; balance: number }>;
}

interface HealthResponse {
  overall_status: "HEALTHY" | "DISCREPANCY_DETECTED";
  is_healthy: boolean;
  diagnostics: DiagnosticItem[];
}

export default function AccountingHealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastCheck, setLastCheck] = useState<string>("");

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<HealthResponse>("/accounting/health");
      setHealth(res);
      setLastCheck(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Health check error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const getModuleIcon = (name: string) => {
    if (name.includes("General Ledger")) return Scale;
    if (name.includes("Customer")) return Users;
    if (name.includes("Supplier")) return Building2;
    if (name.includes("Transport")) return Truck;
    if (name.includes("Bank")) return Landmark;
    if (name.includes("Cash")) return Wallet;
    return ArrowRightLeft;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-0.5 text-xs font-bold font-mono rounded-md ${
                health?.is_healthy
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
              }`}
            >
              {health?.overall_status === "HEALTHY" ? "ALL 7 SUBLEDGERS IN SYNC" : "DISCREPANCY DETECTED"}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Audit Integrity • Last check: {lastCheck || "Loading..."}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Accounting Subledger & GL Health Diagnostics
          </h1>
          <p className="text-xs text-slate-500">
            Real-time automated reconciliation across all 7 operational subledgers vs the General Ledger.
          </p>
        </div>

        <button
          onClick={checkHealth}
          disabled={loading}
          className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Run Integrity Audit</span>
        </button>
      </div>

      <AccountingNav />

      {/* Main Status Hero */}
      {health && (
        <div
          className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            health.is_healthy
              ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
              : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100"
          }`}
        >
          <div className="flex items-center space-x-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                health.is_healthy
                  ? "bg-emerald-600 text-white"
                  : "bg-rose-600 text-white animate-pulse"
              }`}
            >
              {health.is_healthy ? (
                <ShieldCheck className="w-7 h-7" />
              ) : (
                <AlertTriangle className="w-7 h-7" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                {health.is_healthy
                  ? "System Financial Health: PERFECT INTEGRITY"
                  : "Attention Required: Accounting Discrepancy Detected"}
              </h2>
              <p className="text-xs opacity-90 mt-0.5">
                {health.is_healthy
                  ? "Every dollar in Customer Receivables, Supplier Payables, Transport, Bank, Cash, and Sarafi matches General Ledger exactly."
                  : "One or more subledger balances differ from their corresponding GL account code. Review error drilldowns below."}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-2xs font-bold uppercase tracking-wider block opacity-75">
              Verified Core Modules
            </span>
            <span className="text-2xl font-black font-mono">
              {health.diagnostics.filter((d) => d.status === "BALANCED").length} / {health.diagnostics.length}
            </span>
          </div>
        </div>
      )}

      {/* Diagnostics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {health?.diagnostics.map((diag, idx) => {
          const Icon = getModuleIcon(diag.module);
          const isOk = diag.status === "BALANCED";

          return (
            <div
              key={idx}
              className={`bg-white dark:bg-slate-900 rounded-xl border p-5 space-y-3 transition-all ${
                isOk
                  ? "border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800"
                  : "border-rose-300 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isOk
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        : "bg-rose-100 dark:bg-rose-950 text-rose-600"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {diag.module}
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 text-2xs font-mono font-bold rounded flex items-center space-x-1 ${
                    isOk
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  }`}
                >
                  {isOk ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  <span>{diag.status}</span>
                </span>
              </div>

              <div>
                <span className="text-2xs text-slate-400 block">Variance / Discrepancy</span>
                <div
                  className={`text-lg font-black font-mono ${
                    isOk ? "text-emerald-600" : "text-rose-600 font-extrabold"
                  }`}
                >
                  {formatUSD(diag.difference)}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <p className="text-2xs font-mono text-slate-600 dark:text-slate-400">
                  {diag.details}
                </p>
                <div className="flex items-center space-x-1 text-3xs text-slate-400 mt-1">
                  <HelpCircle className="w-3 h-3 shrink-0" />
                  <span>{diag.action}</span>
                </div>
              </div>

              {/* Mismatch Drilldown if present */}
              {diag.mismatches && diag.mismatches.length > 0 && (
                <div className="mt-2 pt-2 border-t border-rose-200 dark:border-rose-800/50 space-y-1">
                  <span className="text-3xs font-bold uppercase text-rose-600 block">
                    Discrepancy Drilldown ({diag.mismatches.length} items):
                  </span>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {diag.mismatches.map((m, mIdx) => (
                      <div key={mIdx} className="flex justify-between text-3xs text-slate-600 dark:text-slate-400">
                        <span>{m.customer}</span>
                        <span className="font-mono font-bold">{formatUSD(m.balance)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Audit Guide Footer */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Double-Entry Ground Truth Rules for AQ COMPANIES</span>
        </h3>
        <ul className="list-disc list-inside space-y-1 text-2xs">
          <li>
            <strong>General Ledger Invariant:</strong> Sum of all posted and reversed GL debits MUST equal sum of all credits to $0.00 difference.
          </li>
          <li>
            <strong>Customer Subledger:</strong> Sum of balance due on all commercial invoices MUST equal net debit on GL Account 1100 Customer Receivables.
          </li>
          <li>
            <strong>Carrier Subledger:</strong> Total payments wires + opening credit minus total freight charges with Sky Ariana MUST equal GL Account 2100.
          </li>
          <li>
            <strong>Bank & Cash Subledgers:</strong> Authoritative running balance on bank accounts and cash vaults MUST equal GL 1000 and GL 1010/1020 balances.
          </li>
          <li>
            <strong>Zero Income/Expense on Transfers:</strong> Money movement between accounts (Bank ↔ Cash ↔ Sarafi) generates ZERO revenue and ZERO expense on principal.
          </li>
        </ul>
      </div>
    </div>
  );
}
