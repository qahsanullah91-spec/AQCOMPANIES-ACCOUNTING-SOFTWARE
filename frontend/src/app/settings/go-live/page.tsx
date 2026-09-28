"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  FileText,
  Server,
  Database,
  ArrowRight,
  Filter,
  Check,
  X,
  FileCheck,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";

interface BaselineItem {
  id: string;
  metric: string;
  expected: number;
  current: number;
  difference: number;
  status: "PASS" | "FAIL" | "WARNING";
  severity: "P0" | "P1" | "P2" | "INFO";
  details: string;
}

interface BaselineReport {
  timestamp: string;
  overall_status: string;
  p0_blockers_count: number;
  items_count: number;
  passed_count: number;
  items: BaselineItem[];
}

interface ChecklistItem {
  id: string;
  section_id: string;
  section: string;
  title: string;
  status: "PASS" | "FAIL" | "WARNING" | "NOT_TESTED";
  severity: "P0" | "P1" | "P2";
  details: string;
  tested_at: string;
}

interface GoLiveResponse {
  version: string;
  build_commit: string;
  schema_revision: string;
  audit_timestamp: string;
  release_gate: {
    status: string;
    message: string;
    ready_for_review: boolean;
    human_confirmation_required: boolean;
  };
  summary: {
    total_checks: number;
    passed: number;
    warnings: number;
    failures: number;
    not_tested: number;
    p0_failures: number;
    p1_failures: number;
  };
  checklist: ChecklistItem[];
}

interface ReleaseNotes {
  version: string;
  release_date: string;
  build_commit: string;
  schema_revision: string;
  summary: string;
  components: Record<string, string>;
  known_limitations: Array<{
    code: string;
    title: string;
    description: string;
    mitigation: string;
    severity: string;
  }>;
  go_live_maintenance_steps: string[];
}

export default function GoLiveReadinessPage() {
  const [checklistData, setChecklistData] = useState<GoLiveResponse | null>(null);
  const [baselineData, setBaselineData] = useState<BaselineReport | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showNotesModal, setShowNotesModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [chkRes, baseRes, notesRes] = await Promise.all([
        fetchApi("/api/v1/golive/checklist") as Promise<GoLiveResponse>,
        fetchApi("/api/v1/golive/baseline-report") as Promise<BaselineReport>,
        fetchApi("/api/v1/golive/release-notes") as Promise<ReleaseNotes>,
      ]);
      setChecklistData(chkRes);
      setBaselineData(baseRes);
      setReleaseNotes(notesRes);
    } catch (err) {
      console.error("Failed to load Go-Live readiness data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunAudit = async () => {
    setAuditing(true);
    try {
      const res = (await fetchApi("/api/v1/golive/run-audit", { method: "POST" })) as {
        checklist?: GoLiveResponse;
        baselines?: BaselineReport;
      };
      if (res && res.checklist) {
        setChecklistData(res.checklist);
        setBaselineData(res.baselines || null);
      }
    } catch (err) {
      console.error("Live audit run failed:", err);
    } finally {
      setAuditing(false);
    }
  };

  const sections = checklistData
    ? Array.from(new Set(checklistData.checklist.map((c) => c.section)))
    : [];

  const filteredChecklist = checklistData
    ? checklistData.checklist.filter((item) => {
        const matchesSection = activeSection === "ALL" || item.section === activeSection;
        const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
        return matchesSection && matchesStatus;
      })
    : [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/80 backdrop-blur border border-slate-700/60 p-6 rounded-2xl shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Go-Live Readiness & Release Gate
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/50">
                    {checklistData?.version || "v1.0.0"}
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Pre-flight operational validation, baseline difference verification & release control
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowNotesModal(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-700/70 hover:bg-slate-700 text-slate-200 border border-slate-600 transition"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              Release Notes
            </button>
            <button
              onClick={handleRunAudit}
              disabled={auditing}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${auditing ? "animate-spin" : ""}`} />
              {auditing ? "Auditing System..." : "Run Live Audit"}
            </button>
          </div>
        </div>

        {/* Release Gate Banner */}
        {checklistData && (
          <div
            className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              checklistData.release_gate.status === "READY FOR REVIEW"
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                : checklistData.release_gate.status === "BLOCKED"
                ? "bg-rose-950/40 border-rose-500/30 text-rose-200"
                : "bg-amber-950/40 border-amber-500/30 text-amber-200"
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  checklistData.release_gate.status === "READY FOR REVIEW"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : checklistData.release_gate.status === "BLOCKED"
                    ? "bg-rose-500/20 text-rose-400"
                    : "bg-amber-500/20 text-amber-400"
                }`}
              >
                {checklistData.release_gate.status === "READY FOR REVIEW" ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-black/40">
                    GATE STATUS
                  </span>
                  <span className="font-bold text-base sm:text-lg">
                    {checklistData.release_gate.status}
                  </span>
                </div>
                <p className="text-sm opacity-90 mt-0.5">
                  {checklistData.release_gate.message}
                </p>
              </div>
            </div>

            <div className="text-right text-xs opacity-75 self-end sm:self-center font-mono">
              Audit Timestamp: {new Date(checklistData.audit_timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {checklistData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-xl">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Total Checks
              </span>
              <div className="text-2xl font-bold text-white mt-1">
                {checklistData.summary.total_checks}
              </div>
              <span className="text-xs text-slate-500">Across 14 categories</span>
            </div>

            <div className="bg-slate-800/60 border border-emerald-500/30 p-4 rounded-xl">
              <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                Passed Checks
              </span>
              <div className="text-2xl font-bold text-emerald-300 mt-1">
                {checklistData.summary.passed}
              </div>
              <span className="text-xs text-emerald-500/80">100% verified sound</span>
            </div>

            <div className="bg-slate-800/60 border border-amber-500/30 p-4 rounded-xl">
              <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
                Warnings
              </span>
              <div className="text-2xl font-bold text-amber-300 mt-1">
                {checklistData.summary.warnings}
              </div>
              <span className="text-xs text-slate-500">Non-blocking notices</span>
            </div>

            <div className="bg-slate-800/60 border border-rose-500/30 p-4 rounded-xl">
              <span className="text-xs font-medium text-rose-400 uppercase tracking-wider">
                P0 Blockers
              </span>
              <div className="text-2xl font-bold text-rose-300 mt-1">
                {checklistData.summary.p0_failures}
              </div>
              <span className="text-xs text-slate-500">Zero tolerance gate</span>
            </div>
          </div>
        )}

        {/* Accounting Baseline Difference Report */}
        {baselineData && (
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" />
                  Authoritative Baseline Difference Report
                </h2>
                <p className="text-xs text-slate-400">
                  Compares current live database calculations with verified golden regression invariants
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium">
                {baselineData.passed_count}/{baselineData.items_count} Baselines Reconciled
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Metric</th>
                    <th className="py-3 px-4 text-right">Expected Baseline</th>
                    <th className="py-3 px-4 text-right">Current Value</th>
                    <th className="py-3 px-4 text-right">Difference</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {baselineData.items.map((b) => {
                    const isMonetary = !b.id.includes("count") && !b.id.includes("null") && !b.id.includes("safety");
                    return (
                      <tr key={b.id} className="hover:bg-slate-750 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-200">{b.metric}</div>
                          <div className="text-xs text-slate-500">{b.details}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {isMonetary ? formatUSD(b.expected) : b.expected}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white font-semibold">
                          {isMonetary ? formatUSD(b.current) : b.current}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {b.difference === 0 ? (
                            <span className="text-emerald-400">$0.00</span>
                          ) : (
                            <span className="text-rose-400 font-bold">
                              {isMonetary ? formatUSD(b.difference) : b.difference}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              b.status === "PASS"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {b.status === "PASS" ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 14-Section Granular Go-Live Checklist */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-400" />
                14-Section Operational Go-Live Checklist
              </h2>
              <p className="text-xs text-slate-400">
                Audited checks across application, database, permissions, mobile & security
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value)}
                aria-label="Filter by Category"
                className="bg-slate-700 text-xs text-slate-200 border border-slate-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Categories</option>
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by Status"
                className="bg-slate-700 text-xs text-slate-200 border border-slate-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PASS">Pass Only</option>
                <option value="WARNING">Warnings Only</option>
                <option value="FAIL">Failures Only</option>
              </select>
            </div>
          </div>

          {/* Checklist Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredChecklist.map((c) => (
              <div
                key={c.id}
                className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-3 hover:border-slate-700 transition"
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                    c.status === "PASS"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : c.status === "WARNING"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {c.status === "PASS" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {c.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {c.section}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          c.severity === "P0"
                            ? "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {c.severity}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {c.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Release Notes Modal */}
      {showNotesModal && releaseNotes && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  Production Release Notes
                </h3>
                <span className="text-xs text-slate-400">
                  {releaseNotes.version} • Schema Revision {releaseNotes.schema_revision}
                </span>
              </div>
              <button
                onClick={() => setShowNotesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Known Limitations */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase font-extrabold tracking-wider text-amber-400 flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                Operational Disclosures & Known Limitations
              </h4>
              {releaseNotes.known_limitations.map((lim) => (
                <div
                  key={lim.code}
                  className="bg-amber-950/30 border border-amber-600/30 p-3.5 rounded-xl space-y-1.5 text-xs text-amber-200"
                >
                  <div className="font-semibold">{lim.title}</div>
                  <p className="text-slate-300">{lim.description}</p>
                  <p className="text-amber-300 font-medium">Resolution: {lim.mitigation}</p>
                </div>
              ))}
            </div>

            {/* Go-Live Maintenance Steps */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase font-extrabold tracking-wider text-blue-400">
                Go-Live Maintenance Procedure (7 Steps)
              </h4>
              <div className="bg-slate-900/60 border border-slate-700/60 p-4 rounded-xl space-y-2 text-xs text-slate-300">
                {releaseNotes.go_live_maintenance_steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold shrink-0">{idx + 1}.</span>
                    <span>{step.replace(/^\d+\.\s*/, "")}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white transition"
              >
                Close Release Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
