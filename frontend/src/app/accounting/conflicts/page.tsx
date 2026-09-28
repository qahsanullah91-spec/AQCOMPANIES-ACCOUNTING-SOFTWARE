"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Search,
  FileText,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  Check,
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface ConflictItem {
  id: number;
  entity: string;
  conflict_type: string;
  source_a: string;
  source_b: string;
  current_value: string;
  status: "RESOLVED" | "UNRESOLVED";
  notes: string;
}

export default function DataConflictCenterPage() {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadConflicts = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<ConflictItem[]>("/conflicts");
      setConflicts(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, []);

  const handleResolve = async (id: number) => {
    try {
      setUpdatingId(id);
      await fetchApi(`/conflicts/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      setConflicts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "RESOLVED" as const } : c))
      );
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredConflicts = conflicts.filter((c) => {
    const matchesSearch =
      c.entity.toLowerCase().includes(search.toLowerCase()) ||
      c.conflict_type.toLowerCase().includes(search.toLowerCase()) ||
      c.current_value.toLowerCase().includes(search.toLowerCase()) ||
      c.notes.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? c.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const totalConflicts = conflicts.length;
  const unresolvedCount = conflicts.filter((c) => c.status === "UNRESOLVED").length;
  const resolvedCount = conflicts.filter((c) => c.status === "RESOLVED").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
            Data Conflict Center & Audit Discrepancies
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Accounting Integrity • Dual-Source Cross-Verification • Excel Migration Audits
          </p>
        </div>

        <button
          onClick={loadConflicts}
          className="btn btn-secondary text-xs flex items-center gap-1.5 font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Audits
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Audited Discrepancies</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalConflicts}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Identified in Excel source workbook</p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Resolved Conflicts</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{resolvedCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Formula-verified & committed safely</p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border-l-4 border-l-amber-500 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Physical Review</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{unresolvedCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">INV-136 Cargo Description</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search conflict entity, type, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-xs w-full font-mono"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select text-xs w-full sm:w-48 font-semibold"
          >
            <option value="">All Audit Statuses</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="UNRESOLVED">UNRESOLVED</option>
          </select>
        </div>
      </div>

      {/* Conflicts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="card p-12 text-center text-slate-400 text-xs">Loading audit conflicts...</div>
        ) : filteredConflicts.length === 0 ? (
          <div className="card p-12 text-center text-slate-400 text-xs">No conflicts match current filter.</div>
        ) : (
          filteredConflicts.map((c) => {
            const isResolved = c.status === "RESOLVED";
            return (
              <div
                key={c.id}
                className={`card p-5 bg-white dark:bg-slate-900 border transition-all ${
                  isResolved
                    ? "border-slate-200 dark:border-slate-800"
                    : "border-amber-300 dark:border-amber-800/80 shadow-md shadow-amber-500/5"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-black text-slate-900 dark:text-white">{c.entity}</span>
                    <span className="badge badge-neutral text-[10px] font-mono">{c.conflict_type}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`badge text-[10px] font-bold ${
                        isResolved
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                      }`}
                    >
                      {c.status}
                    </span>

                    {!isResolved && (
                      <button
                        onClick={() => handleResolve(c.id)}
                        disabled={updatingId === c.id}
                        className="btn btn-primary text-xs py-1 px-3 flex items-center gap-1 font-bold"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark Resolved
                      </button>
                    )}
                  </div>
                </div>

                {/* Source Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Source A (Transport / Visual Entry)
                    </span>
                    <p className="mt-1 font-medium text-slate-800 dark:text-slate-200">{c.source_a}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Source B (Shipment / Formula Logic)
                    </span>
                    <p className="mt-1 font-medium text-slate-800 dark:text-slate-200">{c.source_b}</p>
                  </div>
                </div>

                {/* Current Relational Value & Resolution Audit */}
                <div className="text-xs space-y-1 bg-sky-50/50 dark:bg-sky-950/20 p-3 rounded-lg border border-sky-100 dark:border-sky-900/30">
                  <div className="font-bold text-slate-900 dark:text-white">
                    Committed Database Value: <span className="font-mono text-sky-600 dark:text-sky-400">{c.current_value}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    Audit Note: <span className="italic">{c.notes}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
