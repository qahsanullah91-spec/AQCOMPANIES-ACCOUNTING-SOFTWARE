"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Layers,
  FileCode,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface AuditRecord {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  old_value: string | null;
  new_value: string | null;
  user_name: string;
  timestamp: string;
}

interface AuditLogResponse {
  total: number;
  limit: number;
  offset: number;
  logs: AuditRecord[];
}

export default function FinancialAuditLogPage() {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedEntity, setSelectedEntity] = useState<string>("ALL");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = "/accounting/audit-log?limit=150&";
      if (selectedEntity !== "ALL") query += `entity_type=${selectedEntity}&`;
      if (selectedAction !== "ALL") query += `action=${selectedAction}&`;

      const res = await fetchApi<AuditLogResponse>(query);
      setLogs(res.logs || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load financial audit trail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [selectedEntity, selectedAction]);

  const formatJson = (val: string | null) => {
    if (!val) return "—";
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider rounded-md uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              COMPLIANCE & GOVERNANCE
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Financial Audit Trail
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable log of all accounting transactions, banking actions, payment allocations, reversals, and period closes.
          </p>
        </div>

        <button
          onClick={loadAuditLogs}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      <AccountingNav />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Filter by Entity
            </label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="ALL">All Financial Entities</option>
              <option value="BankTransaction">Bank Transaction</option>
              <option value="BankAccount">Bank Account Master</option>
              <option value="BankReconciliation">Bank Reconciliation</option>
              <option value="AccountingPeriod">Accounting Period</option>
              <option value="Invoice">Sales Invoice</option>
              <option value="Purchase">Purchase Order</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Filter by Action
            </label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="ALLOCATE">ALLOCATE</option>
              <option value="REVERSE">REVERSE</option>
              <option value="MATCH">MATCH</option>
              <option value="UNMATCH">UNMATCH</option>
              <option value="PERIOD_CLOSE">PERIOD CLOSE</option>
              <option value="PERIOD_REOPEN">PERIOD REOPEN</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Showing <strong>{logs.length}</strong> of <strong>{totalCount}</strong> immutable entries
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[10px] font-semibold uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Entity Type</th>
                <th className="py-3 px-4">Entity ID</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Author / User</th>
                <th className="py-3 px-4">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No audit records found matching the filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-4 text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {log.timestamp ? log.timestamp.replace("T", " ").substring(0, 19) : "—"}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                          {log.entity_type}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          #{log.entity_id}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.action === "REVERSE"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                : log.action.includes("CLOSE")
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : log.action === "ALLOCATE"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                          {log.user_name || "System"}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 truncate max-w-xs">
                          {log.new_value || log.old_value || "—"}
                        </td>
                      </tr>

                      {/* Expanded JSON diff drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 dark:bg-slate-950/60">
                          <td colSpan={7} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {log.old_value && (
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block mb-1">
                                    Previous State (Old Value)
                                  </span>
                                  <pre className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] overflow-x-auto text-slate-700 dark:text-slate-300">
                                    {formatJson(log.old_value)}
                                  </pre>
                                </div>
                              )}
                              {log.new_value && (
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block mb-1">
                                    Committed State (New Value)
                                  </span>
                                  <pre className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] overflow-x-auto text-slate-700 dark:text-slate-300">
                                    {formatJson(log.new_value)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
