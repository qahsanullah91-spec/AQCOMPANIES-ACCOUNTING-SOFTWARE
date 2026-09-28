"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowRightLeft,
  Building2,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  Filter,
  Layers,
  Clock,
  FileText,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { API_BASE } from "@/lib/api";

interface Company {
  id: number;
  company_code: string;
  company_name: string;
}

interface ReconciliationPair {
  from_company_id: number;
  from_company_name: string;
  to_company_id: number;
  to_company_name: string;
  due_from: number;
  due_to: number;
  difference: number;
  status: string;
}

interface IntercompanyTx {
  id: number;
  transaction_code: string;
  date: string;
  from_company_id: number;
  from_company_name: string;
  to_company_id: number;
  to_company_name: string;
  transaction_type: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_base: number;
  purpose: string;
  reference: string;
  status: string;
  created_by: string;
  created_at: string;
}

interface AgingPair {
  from_company_id: number;
  from_company_name: string;
  to_company_id: number;
  to_company_name: string;
  current_0_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  total_outstanding: number;
  oldest_date: string | null;
}

export default function IntercompanyAccountingPage() {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [transactions, setTransactions] = useState<IntercompanyTx[]>([]);
  const [aging, setAging] = useState<AgingPair[]>([]);
  const [filterFrom, setFilterFrom] = useState<string>("ALL");
  const [filterTo, setFilterTo] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Form State
  const [fromCompanyId, setFromCompanyId] = useState<number | "">("");
  const [toCompanyId, setToCompanyId] = useState<number | "">("");
  const [txType, setTxType] = useState<string>("PAYMENT_ON_BEHALF");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [purpose, setPurpose] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [compRes, reconRes, txRes, agingRes] = await Promise.all([
        fetch("${API_BASE}/companies"),
        fetch("${API_BASE}/intercompany/reconciliation"),
        fetch("${API_BASE}/intercompany/transactions"),
        fetch("${API_BASE}/intercompany/aging"),
      ]);

      const compJson = await compRes.json();
      const reconJson = await reconRes.json();
      const txJson = await txRes.json();
      const agingJson = await agingRes.json();

      if (compJson?.companies) setCompanies(compJson.companies);
      setReconciliation(reconJson);
      if (txJson?.transactions) setTransactions(txJson.transactions);
      if (agingJson?.aging) setAging(agingJson.aging);
    } catch (err) {
      console.error("Error loading intercompany data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromCompanyId || !toCompanyId || !amount) return;
    if (fromCompanyId === toCompanyId) {
      alert("Source and destination entities must be different.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("${API_BASE}/intercompany/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_company_id: fromCompanyId,
          to_company_id: toCompanyId,
          transaction_type: txType,
          amount: parseFloat(amount),
          currency,
          purpose: purpose || `Intercompany ${txType.toLowerCase()}`,
          reference,
          notes,
          created_by: "Admin",
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setActionNotice(json.message || "Intercompany transaction created successfully.");
        setModalOpen(false);
        setAmount("");
        setPurpose("");
        setReference("");
        setNotes("");
        fetchData();
      } else {
        alert(json.detail || "Failed to record intercompany transaction.");
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = async (id: number) => {
    const reason = prompt("Enter reason for reversing this intercompany transaction:");
    if (!reason) return;

    try {
      const res = await fetch(`${API_BASE}/intercompany/transactions/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, user_name: "Admin" }),
      });
      const json = await res.json();
      if (res.ok) {
        setActionNotice(json.message || "Transaction reversed.");
        fetchData();
      } else {
        alert(json.detail || "Failed to reverse transaction.");
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    }
  };

  const handleSettle = async (id: number) => {
    const ref = prompt("Enter settlement payment reference (wire or check #):", `WIRE-${Date.now().toString().slice(-6)}`);
    if (!ref) return;

    try {
      const res = await fetch(`${API_BASE}/intercompany/transactions/${id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlement_reference: ref, user_name: "Admin" }),
      });
      const json = await res.json();
      if (res.ok) {
        setActionNotice(json.message || "Transaction settled.");
        fetchData();
      } else {
        alert(json.detail || "Failed to settle transaction.");
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filterFrom !== "ALL" && t.from_company_id.toString() !== filterFrom) return false;
    if (filterTo !== "ALL" && t.to_company_id.toString() !== filterTo) return false;
    if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
    return true;
  });

  const reconPairs: ReconciliationPair[] = reconciliation?.reconciliation_pairs || [];
  const fromCompObj = companies.find((c) => c.id === fromCompanyId);
  const toCompObj = companies.find((c) => c.id === toCompanyId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AccountingNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">Intercompany Accounting Center</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated Due To (2350) / Due From (1370) dual-sided ledger matching & reconciliation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchData}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Intercompany Transaction</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Due From (1370)</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ${reconciliation ? (reconciliation.total_due_from || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "..."}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Intercompany Receivables Asset</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Due To (2350)</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ${reconciliation ? (reconciliation.total_due_to || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "..."}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Intercompany Payables Liability</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Reconciliation Difference</div>
          <div className={`text-2xl font-black ${
            (reconciliation?.net_difference || 0) === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}>
            ${reconciliation ? (reconciliation.net_difference || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "..."}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {(reconciliation?.net_difference || 0) === 0 ? "100% Balanced ($0.00)" : "Out of balance alert"}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Matching Status</div>
          <div className="flex items-center space-x-1.5 mt-1">
            {(reconciliation?.status || "BALANCED") === "BALANCED" ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>BALANCED & IN-SYNC</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>DISCREPANCY DETECTED</span>
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Auto-eliminated in Consolidated Reports
          </div>
        </div>
      </div>

      {/* Pair-wise Due To vs Due From Reconciliation Matrix */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Pair-Wise Intercompany Reconciliation Matrix</h2>
          <p className="text-[11px] text-slate-500">Cross-checks Company A Receivable (1370) against Company B Payable (2350)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Entity A (Creditor)</th>
                <th className="py-2.5 px-4">Entity B (Debtor)</th>
                <th className="py-2.5 px-4 text-right">Due From Entity B ($)</th>
                <th className="py-2.5 px-4 text-right">Due To Entity A ($)</th>
                <th className="py-2.5 px-4 text-right">Variance ($)</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reconPairs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                    No active intercompany debtor-creditor relationships currently outstanding.
                  </td>
                </tr>
              ) : (
                reconPairs.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{p.from_company_name}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{p.to_company_name}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ${p.due_from.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ${p.due_to.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      <span className={p.difference === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        ${Math.abs(p.difference).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === "MATCHED"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                            : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Intercompany Aging Table */}
      {aging.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Intercompany Aging Schedule</h2>
            <p className="text-[11px] text-slate-500">Unsettled operational and liquidity balances categorized by age</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">From Entity</th>
                  <th className="py-2.5 px-4">To Entity</th>
                  <th className="py-2.5 px-4 text-right">0–30 Days</th>
                  <th className="py-2.5 px-4 text-right">31–60 Days</th>
                  <th className="py-2.5 px-4 text-right">61–90 Days</th>
                  <th className="py-2.5 px-4 text-right">90+ Days</th>
                  <th className="py-2.5 px-4 text-right">Total Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {aging.map((a, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-sans font-bold text-slate-900 dark:text-white">{a.from_company_name}</td>
                    <td className="py-2.5 px-4 font-sans font-bold text-slate-900 dark:text-white">{a.to_company_name}</td>
                    <td className="py-2.5 px-4 text-right">${a.current_0_30.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-4 text-right">${a.days_31_60.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-4 text-right">${a.days_61_90.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-4 text-right text-amber-600 dark:text-amber-400 font-bold">
                      ${a.days_90_plus.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-sky-600 dark:text-sky-400">
                      ${a.total_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Intercompany Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Intercompany Transactions Journal</h2>
            <p className="text-[11px] text-slate-500">Every record is linked to balanced dual journal entries across both entities</p>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">From: All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
            <select
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">To: All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="MATCHED">MATCHED</option>
              <option value="SETTLED">SETTLED</option>
              <option value="REVERSED">REVERSED</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Code / Date</th>
                <th className="py-2.5 px-4">Origin Entity</th>
                <th className="py-2.5 px-4">Counterparty Entity</th>
                <th className="py-2.5 px-4">Type / Purpose</th>
                <th className="py-2.5 px-4 text-right">Amount (USD)</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                    No intercompany transactions found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">{tx.transaction_code}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tx.date}</div>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{tx.from_company_name}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{tx.to_company_name}</td>
                    <td className="py-2.5 px-4">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {tx.transaction_type}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5">{tx.purpose}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.status === "SETTLED"
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            : tx.status === "REVERSED"
                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400"
                            : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {tx.status === "MATCHED" && (
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleSettle(tx.id)}
                            className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 text-[10px] font-semibold transition-colors"
                            title="Settle this balance"
                          >
                            Settle
                          </button>
                          <button
                            onClick={() => handleReverse(tx.id)}
                            className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 text-[10px] font-semibold transition-colors"
                            title="Reverse transaction & journals"
                          >
                            Reverse
                          </button>
                        </div>
                      )}
                      {tx.status !== "MATCHED" && (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* + Intercompany Transaction Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Record Intercompany Transaction</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    From Entity (Payer / Creditor)
                  </label>
                  <select
                    value={fromCompanyId}
                    onChange={(e) => setFromCompanyId(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select originating entity...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    To Entity (Beneficiary / Debtor)
                  </label>
                  <select
                    value={toCompanyId}
                    onChange={(e) => setToCompanyId(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select recipient entity...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.id === fromCompanyId}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Type</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="PAYMENT_ON_BEHALF">PAYMENT_ON_BEHALF</option>
                    <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                    <option value="CASH_TRANSFER">CASH_TRANSFER</option>
                    <option value="EXPENSE_ON_BEHALF">EXPENSE_ON_BEHALF</option>
                    <option value="LOAN">LOAN</option>
                    <option value="ADVANCE">ADVANCE</option>
                    <option value="SETTLEMENT">SETTLEMENT</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="AFN">AFN</option>
                    <option value="AED">AED</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Purpose / Reason</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Dubai port demurrage paid on behalf of Afghanistan entity"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Reference</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. INV-REF-109"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Audit documentation notes"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Live Dual-Journal Accounting Preview */}
              {fromCompObj && toCompObj && amount && (
                <div className="p-3.5 rounded-xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/20 space-y-2">
                  <div className="font-bold text-sky-900 dark:text-sky-300 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Automated Dual-Sided Journal Preview</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                    <div className="p-2 rounded bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">{fromCompObj.company_name}</div>
                      <div className="text-emerald-600 font-mono">Dr 1370 Due From Related Companies: ${parseFloat(amount).toLocaleString()}</div>
                      <div className="text-rose-600 font-mono">Cr 1000 Bank Account: ${parseFloat(amount).toLocaleString()}</div>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">{toCompObj.company_name}</div>
                      <div className="text-emerald-600 font-mono">Dr 1000 Bank / Expense: ${parseFloat(amount).toLocaleString()}</div>
                      <div className="text-rose-600 font-mono">Cr 2350 Due To Related Companies: ${parseFloat(amount).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? "Posting..." : "Post Intercompany Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
