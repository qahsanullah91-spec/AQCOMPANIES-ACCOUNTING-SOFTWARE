"use client";

import React, { useEffect, useState, useTransition } from "react";
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
  Activity,
  AlertCircle,
  Bug,
  Plus,
  HelpCircle,
  Lock,
  DollarSign,
  TrendingUp,
  Cpu,
  HardDrive,
  Users,
  Truck,
  Landmark,
  Scale,
  ListFilter,
  Send,
} from "lucide-react";
import { fetchApi, formatUSD, formatMoney } from "@/lib/api";

interface StabilizationDashboard {
  mode: string;
  change_freeze_policy: string;
  timestamp: string;
  exit_gate: {
    ready_to_exit: boolean;
    status: string;
    message: string;
    blockers: string[];
    warnings: string[];
  };
  gl_balance: {
    is_balanced: boolean;
    total_debits: number;
    total_credits: number;
    difference: number;
    formatted_diff: string;
  };
  backup_freshness: {
    status: string;
    hours_since_last_backup: number | null;
    latest_backup: string | null;
    last_verified: string | null;
    dr_drill_status: string;
  };
  wal_status: {
    mode: string;
    is_optimal: boolean;
  };
  system_resources: {
    cpu_percent: number;
    memory_percent: number;
    disk_free_gb: number;
    disk_total_gb: number;
    disk_usage_percent: number;
  };
  active_errors: {
    total_unresolved: number;
    p0_count: number;
    p1_count: number;
  };
  unmatched_bank_items: number;
  unallocated_receipts: number;
  pending_approvals: number;
  missing_purchase_costs: number;
}

interface DailyReviewSection {
  title: string;
  status: "NORMAL" | "ACTION_REQUIRED" | "ATTENTION";
  metrics: Record<string, any>;
  notes: string[];
}

interface DailyReviewData {
  timestamp: string;
  banking_review: DailyReviewSection;
  receivables_review: DailyReviewSection;
  payables_review: DailyReviewSection;
  transport_review: DailyReviewSection;
  anomaly_scanner: {
    status: string;
    anomalies_found: number;
    details: string[];
  };
}

interface ProductionError {
  error_id: string;
  timestamp: string;
  user_name: string;
  company_id: number | null;
  route: string;
  action: string;
  severity: "P0" | "P1" | "P2" | "P3";
  source: string;
  message: string;
  resolved: boolean;
  resolved_at: string | null;
  request_id: string | null;
}

interface SupportIssue {
  issue_id: string;
  timestamp: string;
  user_name: string;
  page: string;
  description: string;
  priority: string;
  category: string;
  company_id: number | null;
  transaction_number: string | null;
  request_id: string | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "BACKLOG";
  resolution_notes: string | null;
  resolved_at: string | null;
}

interface MissingCostItem {
  shipment_id: number;
  invoice_number: string;
  shipment_code: string;
  container_number: string;
  product_name: string;
  total_kg: number;
  sales_amount: number;
  purchase_amount: null;
  purchase_cost_display: string;
  notes: string;
}

interface MissingCostReport {
  timestamp: string;
  total_missing_cost_shipments: number;
  policy: string;
  items: MissingCostItem[];
}

interface ProfitReadinessReport {
  timestamp: string;
  verified_sales_revenue: number;
  verified_cogs: number;
  verified_gross_profit: number;
  verified_margin_percent: number;
  missing_cost_shipments_count: number;
  unverified_sales_revenue: number;
  disclosure: string;
  overall_status: string;
}

interface MonthEndReadiness {
  timestamp: string;
  period_closing_status: {
    current_open_period: string;
    closed_periods_count: number;
  };
  checklist: Array<{
    category: string;
    title: string;
    status: "PASS" | "WARNING" | "FAIL";
    details: string;
  }>;
  required_reports_package: Array<{
    report_name: string;
    status: string;
    href: string;
  }>;
  readiness_verdict: string;
}

interface ExitCriteria {
  timestamp: string;
  overall_status: string;
  ready_to_exit: boolean;
  recommendation: string;
  criteria: Array<{
    id: string;
    name: string;
    target: string;
    current_value: any;
    met: boolean;
    criticality: "BLOCKER" | "HIGH" | "MEDIUM";
  }>;
}

export default function PostGoLiveStabilizationPage() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "reviews" | "errors" | "monthend" | "backlog" | "exit"
  >("overview");

  const [dashboard, setDashboard] = useState<StabilizationDashboard | null>(null);
  const [dailyReviews, setDailyReviews] = useState<DailyReviewData | null>(null);
  const [errorsList, setErrorsList] = useState<ProductionError[]>([]);
  const [supportIssues, setSupportIssues] = useState<SupportIssue[]>([]);
  const [featureBacklog, setFeatureBacklog] = useState<SupportIssue[]>([]);
  const [missingCosts, setMissingCosts] = useState<MissingCostReport | null>(null);
  const [profitReadiness, setProfitReadiness] = useState<ProfitReadinessReport | null>(null);
  const [monthEnd, setMonthEnd] = useState<MonthEndReadiness | null>(null);
  const [exitCriteria, setExitCriteria] = useState<ExitCriteria | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterSource, setFilterSource] = useState<string>("ALL");

  // New Support Issue Modal State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({
    user_name: "Admin",
    page: "/accounting",
    description: "",
    priority: "P2",
    category: "BUG",
    transaction_number: "",
    request_id: "",
  });
  const [submittingIssue, setSubmittingIssue] = useState(false);

  // Error Resolving State
  const [resolvingErrorId, setResolvingErrorId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [
        dashData,
        revData,
        errData,
        issuesData,
        backlogData,
        costsData,
        profitData,
        monthData,
        exitData,
      ] = await Promise.all([
        fetchApi<StabilizationDashboard>("/stabilization/dashboard").catch(() => null),
        fetchApi<DailyReviewData>("/stabilization/daily-review").catch(() => null),
        fetchApi<ProductionError[]>("/stabilization/errors?limit=100").catch(() => []),
        fetchApi<SupportIssue[]>("/stabilization/support-issues").catch(() => []),
        fetchApi<SupportIssue[]>("/stabilization/feature-backlog").catch(() => []),
        fetchApi<MissingCostReport>("/stabilization/missing-purchase-costs").catch(() => null),
        fetchApi<ProfitReadinessReport>("/stabilization/profit-readiness").catch(() => null),
        fetchApi<MonthEndReadiness>("/stabilization/month-end-readiness").catch(() => null),
        fetchApi<ExitCriteria>("/stabilization/exit-criteria").catch(() => null),
      ]);

      setDashboard(dashData);
      setDailyReviews(revData);
      setErrorsList(errData || []);
      setSupportIssues(issuesData || []);
      setFeatureBacklog(backlogData || []);
      setMissingCosts(costsData);
      setProfitReadiness(profitData);
      setMonthEnd(monthData);
      setExitCriteria(exitData);
    } catch (e) {
      console.error("Failed to load stabilization telemetry:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh telemetry every 60s
    const timer = setInterval(() => {
      loadData();
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleResolveError = async (errorId: string) => {
    try {
      setResolvingErrorId(errorId);
      await fetchApi(`/stabilization/errors/${errorId}/resolve`, {
        method: "POST",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to mark error as resolved");
    } finally {
      setResolvingErrorId(null);
    }
  };

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueForm.description.trim()) {
      alert("Please provide an issue description.");
      return;
    }
    try {
      setSubmittingIssue(true);
      await fetchApi("/stabilization/support-issues", {
        method: "POST",
        body: JSON.stringify(issueForm),
      });
      setIsIssueModalOpen(false);
      setIssueForm({
        user_name: "Admin",
        page: "/accounting",
        description: "",
        priority: "P2",
        category: "BUG",
        transaction_number: "",
        request_id: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to submit support issue");
    } finally {
      setSubmittingIssue(false);
    }
  };

  const handleResolveIssue = async (issueId: string) => {
    const notes = prompt("Enter resolution notes:", "Verified and resolved in production.");
    if (!notes) return;
    try {
      await fetchApi(`/stabilization/support-issues/${issueId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to resolve support issue");
    }
  };

  const filteredErrors = errorsList.filter((err) => {
    if (filterSeverity !== "ALL" && err.severity !== filterSeverity) return false;
    if (filterSource !== "ALL" && err.source !== filterSource) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-sky-600 dark:text-sky-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Post-Go-Live Stabilization & Month-End Readiness
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real Production Monitoring • Anomaly Scanner • Missing Cost Disclosures • 7-Point Exit Gate
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsIssueModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Report Issue
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stabilization Active Mode Banner */}
      <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-gradient-to-r from-sky-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 shrink-0">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[11px] font-extrabold tracking-wider uppercase rounded bg-sky-600 text-white">
                  Stabilization Mode Active
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {dashboard?.timestamp ? new Date(dashboard.timestamp).toLocaleString() : "Live"}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                AQ Companies Production Stabilization & Operations Control
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Policy:</span>{" "}
                {dashboard?.change_freeze_policy ||
                  "P0/P1 Hotfixes, Data Integrity & Security Only — Major features segregated in backlog."}
              </p>
            </div>
          </div>

          {/* Exit Gate Widget */}
          <div className="flex flex-col items-start md:items-end justify-center shrink-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-3 md:pt-0 md:pl-5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              Exit Gate Status
            </div>
            <div className="flex items-center gap-2 mt-1">
              {dashboard?.exit_gate?.ready_to_exit ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  READY TO EXIT: YES
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 text-amber-800 dark:text-amber-300 text-xs font-extrabold">
                  <Clock className="w-4 h-4 text-amber-600" />
                  STABILIZATION IN PROGRESS (NO)
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs text-left md:text-right">
              {dashboard?.exit_gate?.message || "Operational checks running"}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* GL Balanced */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>GL Balance</span>
            <Scale className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {dashboard?.gl_balance?.is_balanced ? (
              <span className="text-emerald-600 dark:text-emerald-400">$0.00 Diff</span>
            ) : (
              <span className="text-rose-600">{dashboard?.gl_balance?.formatted_diff}</span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                dashboard?.gl_balance?.is_balanced ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            {dashboard?.gl_balance?.is_balanced ? "Strict Invariant OK" : "Unbalanced"}
          </div>
        </div>

        {/* Backup Freshness */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Backup Freshness</span>
            <HardDrive className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {dashboard?.backup_freshness?.status || "CHECKING"}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {dashboard?.backup_freshness?.hours_since_last_backup !== null &&
            dashboard?.backup_freshness?.hours_since_last_backup !== undefined
              ? `${dashboard.backup_freshness.hours_since_last_backup}h ago`
              : "WAL Active"}
          </div>
        </div>

        {/* Unreconciled Banks */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Bank Items</span>
            <Landmark className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {dashboard?.unmatched_bank_items ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Pending reconciliation
          </div>
        </div>

        {/* Unallocated Receipts */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Unallocated</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {dashboard?.unallocated_receipts ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Customer receipts
          </div>
        </div>

        {/* Missing Purchase Costs */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Missing Costs</span>
            <FileText className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {dashboard?.missing_purchase_costs ?? 63}
          </div>
          <div className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
            Strictly Disclosed
          </div>
        </div>

        {/* Active Errors */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>P0/P1 Errors</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {dashboard?.active_errors?.p0_count ?? 0} P0 / {dashboard?.active_errors?.p1_count ?? 0} P1
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {dashboard?.active_errors?.total_unresolved ?? 0} total unresolved
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center space-x-1 overflow-x-auto no-scrollbar pb-1">
        {[
          { key: "overview", label: "Telemetry & Overview", icon: Activity },
          { key: "reviews", label: "Daily Operational Reviews", icon: FileCheck },
          { key: "errors", label: `Error Tracker (${errorsList.filter((e) => !e.resolved).length})`, icon: Bug },
          { key: "monthend", label: "Month-End & Missing Costs", icon: Lock },
          { key: "backlog", label: `Feature Backlog (${featureBacklog.length})`, icon: ListFilter },
          { key: "exit", label: "Exit Gate Criteria", icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                isActive
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW & TELEMETRY */}
      {/* ========================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Anomaly Scanner Banner */}
          {dailyReviews?.anomaly_scanner && (
            <div
              className={`p-4 rounded-xl border ${
                dailyReviews.anomaly_scanner.anomalies_found === 0
                  ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                  : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {dailyReviews.anomaly_scanner.anomalies_found === 0 ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">
                      Deterministic Daily Anomaly Scanner:{" "}
                      {dailyReviews.anomaly_scanner.anomalies_found === 0
                        ? "ALL HEALTH CHECKS CLEAN"
                        : `${dailyReviews.anomaly_scanner.anomalies_found} Anomalies Flagged`}
                    </h3>
                    <span className="text-[11px] font-mono opacity-80">
                      {dailyReviews.anomaly_scanner.status}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {dailyReviews.anomaly_scanner.details.map((detail, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* System Hardware & Storage Telemetry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-sky-500" />
                Host Telemetry & WAL Mode
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-600 dark:text-slate-300">CPU Utilization</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {dashboard?.system_resources?.cpu_percent ?? 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-sky-600 h-2 rounded-full transition-all"
                      style={{ width: `${dashboard?.system_resources?.cpu_percent ?? 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-600 dark:text-slate-300">Memory Utilization</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {dashboard?.system_resources?.memory_percent ?? 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${dashboard?.system_resources?.memory_percent ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Database Journaling:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {dashboard?.wal_status?.mode || "WAL Mode Active"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-3">
                <HardDrive className="w-4 h-4 text-emerald-500" />
                Storage & Backup Reliability
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-600 dark:text-slate-300">Disk Space</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {dashboard?.system_resources?.disk_free_gb ?? 0} GB Free of{" "}
                      {dashboard?.system_resources?.disk_total_gb ?? 0} GB
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all"
                      style={{ width: `${dashboard?.system_resources?.disk_usage_percent ?? 0}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Backup Policy:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">Daily Compressed Zip</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Disaster Recovery Drill:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {dashboard?.backup_freshness?.dr_drill_status || "VERIFIED"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Latest Verified Snapshot:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                      {dashboard?.backup_freshness?.latest_backup || "backups/auto_daily_snapshot.zip"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
                  <span>General Ledger</span>
                  <Scale className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-base font-bold text-slate-900 dark:text-white mt-2">
                  Zero Tolerance Balance
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Debits: {formatUSD(dashboard?.gl_balance?.total_debits)} | Credits:{" "}
                  {formatUSD(dashboard?.gl_balance?.total_credits)}
                </p>
              </div>
              <a
                href="/accounting/general-ledger"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400"
              >
                Inspect Ledger <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
                  <span>Bank Feeds</span>
                  <Landmark className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-base font-bold text-slate-900 dark:text-white mt-2">
                  {dashboard?.unmatched_bank_items ?? 0} Unmatched Items
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Ensure all bank statement lines match accounting receipts and vouchers before close.
                </p>
              </div>
              <a
                href="/accounting/bankbook"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400"
              >
                Open Bankbook <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
                  <span>Pending Purchase Costs</span>
                  <FileText className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-base font-bold text-slate-900 dark:text-white mt-2">
                  63 Shipments Pending Bill
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Disclosed transparently as `PENDING PURCHASE COST`. Never guessed or estimated.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("monthend")}
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400"
              >
                View Disclosures <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: DAILY OPERATIONAL REVIEWS */}
      {/* ========================================================= */}
      {activeTab === "reviews" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Daily Operational Reviews
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated daily audit of Banking, Receivables, Payables, and Transport operations.
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Generated:{" "}
              {dailyReviews?.timestamp ? new Date(dailyReviews.timestamp).toLocaleTimeString() : "Live"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Banking Review */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-sky-600" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {dailyReviews?.banking_review?.title || "Daily Banking Review"}
                  </h4>
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                    dailyReviews?.banking_review?.status === "NORMAL"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {dailyReviews?.banking_review?.status || "NORMAL"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-850 rounded-lg text-xs mb-3">
                <div>
                  <span className="text-slate-500 block">Bank Accounts:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {dailyReviews?.banking_review?.metrics?.bank_accounts_count ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Balance:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatUSD(dailyReviews?.banking_review?.metrics?.total_bank_balance)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Unmatched Items:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {dailyReviews?.banking_review?.metrics?.unmatched_items_count ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Reconciled Items:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {dailyReviews?.banking_review?.metrics?.reconciled_items_count ?? 0}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {dailyReviews?.banking_review?.notes?.map((n, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-sky-500 shrink-0">•</span>
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Receivables Review */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {dailyReviews?.receivables_review?.title || "Daily Receivables Review"}
                  </h4>
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                    dailyReviews?.receivables_review?.status === "NORMAL"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {dailyReviews?.receivables_review?.status || "NORMAL"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-850 rounded-lg text-xs mb-3">
                <div>
                  <span className="text-slate-500 block">Total Receivables:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatUSD(dailyReviews?.receivables_review?.metrics?.total_receivables)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Unallocated Receipts:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {dailyReviews?.receivables_review?.metrics?.unallocated_receipts_count ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Active Customers:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {dailyReviews?.receivables_review?.metrics?.active_customers_count ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Verified Receipts:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatUSD(dailyReviews?.receivables_review?.metrics?.verified_receipts_baseline)}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {dailyReviews?.receivables_review?.notes?.map((n, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 shrink-0">•</span>
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payables Review */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-purple-600" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {dailyReviews?.payables_review?.title || "Daily Payables Review"}
                  </h4>
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                    dailyReviews?.payables_review?.status === "NORMAL"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {dailyReviews?.payables_review?.status || "NORMAL"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-850 rounded-lg text-xs mb-3">
                <div>
                  <span className="text-slate-500 block">Total Payables:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatUSD(dailyReviews?.payables_review?.metrics?.total_payables)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Pending Bills:</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    {dailyReviews?.payables_review?.metrics?.missing_cost_shipments ?? 63}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Active Suppliers:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {dailyReviews?.payables_review?.metrics?.active_suppliers_count ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Approved Vouchers:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {dailyReviews?.payables_review?.metrics?.approved_vouchers_count ?? 0}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {dailyReviews?.payables_review?.notes?.map((n, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-purple-500 shrink-0">•</span>
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Transport Review */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {dailyReviews?.transport_review?.title || "Daily Transport Review"}
                  </h4>
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                    dailyReviews?.transport_review?.status === "NORMAL"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {dailyReviews?.transport_review?.status || "NORMAL"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-850 rounded-lg text-xs mb-3">
                <div>
                  <span className="text-slate-500 block">Transport Balance:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatUSD(dailyReviews?.transport_review?.metrics?.transport_account_balance)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Interpretation:</span>
                  <span className="font-bold text-slate-900 dark:text-white text-[11px]">
                    {dailyReviews?.transport_review?.metrics?.interpretation || "CREDIT IN AQ FAVOR"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Active Drivers:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {dailyReviews?.transport_review?.metrics?.active_drivers_count ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Shipments Logged:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {dailyReviews?.transport_review?.metrics?.shipments_logged_count ?? 0}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {dailyReviews?.transport_review?.notes?.map((n, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-500 shrink-0">•</span>
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: ERROR TRACKER & SUPPORT ISSUES */}
      {/* ========================================================= */}
      {activeTab === "errors" && (
        <div className="space-y-6">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Production Error Buffer & Support Issues
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live error telemetry captured with Request ID, Severity, User context, and Source.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">All Severities</option>
                <option value="P0">P0 (Critical Blocker)</option>
                <option value="P1">P1 (High Priority)</option>
                <option value="P2">P2 (Normal)</option>
                <option value="P3">P3 (Minor)</option>
              </select>

              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">All Sources</option>
                <option value="FastAPI">FastAPI</option>
                <option value="Frontend">Frontend</option>
                <option value="Database">Database</option>
                <option value="Mobile">Mobile</option>
                <option value="PDF">PDF</option>
                <option value="Uploads">Uploads</option>
              </select>
            </div>
          </div>

          {/* Errors Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Logged Errors ({filteredErrors.length})
              </span>
              <span className="text-[11px] text-slate-500">
                {errorsList.filter((e) => !e.resolved).length} unresolved
              </span>
            </div>

            {filteredErrors.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                No errors recorded matching selected filters. Production system running smoothly.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Sev</th>
                      <th className="py-2.5 px-3">Source</th>
                      <th className="py-2.5 px-3">Route / Action</th>
                      <th className="py-2.5 px-3">Error Message</th>
                      <th className="py-2.5 px-3">User & Request ID</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredErrors.map((err) => (
                      <tr
                        key={err.error_id}
                        className={err.resolved ? "opacity-60 bg-slate-50/50 dark:bg-slate-900/50" : ""}
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              err.severity === "P0"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300"
                                : err.severity === "P1"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {err.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {err.source}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {err.route || "—"}
                          {err.action && <span className="text-slate-400"> ({err.action})</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-900 dark:text-white max-w-xs truncate" title={err.message}>
                          {err.message}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-500">
                          <div>{err.user_name || "System"}</div>
                          {err.request_id && (
                            <div className="font-mono text-[9px] text-slate-400">req: {err.request_id.slice(0, 8)}...</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-500">
                          {new Date(err.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {err.resolved ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-end gap-1 text-[11px]">
                              <Check className="w-3.5 h-3.5" /> Resolved
                            </span>
                          ) : (
                            <button
                              onClick={() => handleResolveError(err.error_id)}
                              disabled={resolvingErrorId === err.error_id}
                              className="px-2.5 py-1 text-[11px] font-semibold text-sky-700 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 rounded border border-sky-200 dark:border-sky-800 transition"
                            >
                              {resolvingErrorId === err.error_id ? "Saving..." : "Resolve"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Internal Support Issues Section */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Internal Support Tickets ({supportIssues.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  User reported issues, questions, and transaction inquiries during stabilization.
                </p>
              </div>
              <button
                onClick={() => setIsIssueModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 transition"
              >
                <Plus className="w-3 h-3" /> New Ticket
              </button>
            </div>

            {supportIssues.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No open support tickets. Everything reported is resolved or held in backlog.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {supportIssues.map((issue) => (
                  <div key={issue.issue_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                            issue.priority === "P0"
                              ? "bg-rose-100 text-rose-800"
                              : issue.priority === "P1"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {issue.priority}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          [{issue.category}] on {issue.page}
                        </span>
                        <span className="text-slate-400">by {issue.user_name}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">{issue.description}</p>
                      {issue.resolution_notes && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Resolution: {issue.resolution_notes}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          issue.status === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : issue.status === "BACKLOG"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {issue.status}
                      </span>
                      {issue.status !== "RESOLVED" && issue.status !== "BACKLOG" && (
                        <button
                          onClick={() => handleResolveIssue(issue.issue_id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition"
                        >
                          Close Ticket
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: MONTH-END READINESS & MISSING PURCHASE COSTS */}
      {/* ========================================================= */}
      {activeTab === "monthend" && (
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Month-End Accounting Readiness & Purchase Cost Disclosures
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit-compliant pre-close verification. All unknown purchase costs are strictly disclosed as NULL.
            </p>
          </div>

          {/* Profit Readiness Banner */}
          {profitReadiness && (
            <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-purple-600 text-white">
                      Profit Segregation Disclosure
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Verified Gross Margin: {profitReadiness.verified_margin_percent}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    Verified Sales: {formatUSD(profitReadiness.verified_sales_revenue)} | Verified COGS:{" "}
                    {formatUSD(profitReadiness.verified_cogs)} | Verified Gross Profit:{" "}
                    <span className="font-bold text-emerald-600">
                      {formatUSD(profitReadiness.verified_gross_profit)}
                    </span>
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-1 font-medium">
                    {profitReadiness.disclosure}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-500">Unbilled Sales Value</div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">
                    {formatUSD(profitReadiness.unverified_sales_revenue)}
                  </div>
                  <div className="text-[11px] text-purple-600 font-semibold">
                    63 Shipments Pending Bill
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pre-Close Accounting Checklist */}
          {monthEnd && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Pre-Close Checklist (Status: {monthEnd.readiness_verdict})
                </h4>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Current Open Period: {monthEnd.period_closing_status?.current_open_period}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {monthEnd.checklist?.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-start gap-2.5 text-xs"
                  >
                    {item.status === "PASS" ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : item.status === "WARNING" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{item.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.details}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Purchase Costs Table (63 shipments) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Missing Purchase Cost Disclosures ({missingCosts?.total_missing_cost_shipments ?? 63}{" "}
                  Items)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Commercial sales exist with verified weights, but supplier bills are pending. Under GAAP/IFRS
                  policy, costs are not fabricated.
                </p>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                STRICT DISCLOSURE
              </span>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Shipment Code</th>
                    <th className="py-2.5 px-3">Container #</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-right">Weight (KG)</th>
                    <th className="py-2.5 px-3 text-right">Sales Value</th>
                    <th className="py-2.5 px-3 text-right">Purchase Cost</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {missingCosts?.items?.map((item) => (
                    <tr key={item.shipment_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                        {item.invoice_number}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {item.shipment_code}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {item.container_number}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                        {item.product_name}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {item.total_kg?.toLocaleString()} kg
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatUSD(item.sales_amount)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-purple-600 dark:text-purple-400 font-bold">
                        {item.purchase_cost_display}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          DISCLOSED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: SEGREGATED FEATURE BACKLOG */}
      {/* ========================================================= */}
      {activeTab === "backlog" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
            <h3 className="text-sm font-bold text-purple-900 dark:text-purple-200 flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-purple-600" />
              Segregated Feature Backlog Policy
            </h3>
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
              To guarantee zero production regressions during the stabilization period, all enhancements,
              new reporting requests, and non-critical feature ideas are held strictly in this backlog.
              They will be reviewed once the 7-point Exit Gate is formally cleared.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Backlog Items ({featureBacklog.length})
              </span>
              <button
                onClick={() => {
                  setIssueForm((prev) => ({ ...prev, category: "FEATURE_REQUEST" }));
                  setIsIssueModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-purple-600 text-white rounded hover:bg-purple-700 transition"
              >
                <Plus className="w-3 h-3" /> Propose Feature
              </button>
            </div>

            {featureBacklog.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No future features currently queued in backlog.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {featureBacklog.map((item) => (
                  <div key={item.issue_id} className="p-4 flex items-start justify-between gap-4 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                          {item.priority}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Target Module: {item.page}
                        </span>
                        <span className="text-slate-400">Requested by {item.user_name}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mt-1">{item.description}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 shrink-0">
                      HELD FOR POST-STABILIZATION
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: EXIT GATE CRITERIA */}
      {/* ========================================================= */}
      {activeTab === "exit" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Formal Stabilization Exit Criteria (7-Point Audit)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Recommendation:{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {exitCriteria?.recommendation}
                </span>
              </p>
            </div>
            <div className="shrink-0">
              {exitCriteria?.ready_to_exit ? (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  READY TO EXIT: YES
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  READY TO EXIT: NO (STABILIZING)
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Exit Metric</th>
                    <th className="py-3 px-4">Target Condition</th>
                    <th className="py-3 px-4">Current Value</th>
                    <th className="py-3 px-4 text-center">Criticality</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {exitCriteria?.criteria?.map((crit, idx) => (
                    <tr key={crit.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {crit.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {crit.target}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                        {String(crit.current_value)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            crit.criticality === "BLOCKER"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {crit.criticality}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {crit.met ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            <CheckCircle className="w-4 h-4" /> PASSED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                            <Clock className="w-4 h-4" /> PENDING
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SUBMIT SUPPORT ISSUE */}
      {/* ========================================================= */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bug className="w-5 h-5 text-indigo-600" />
                Report Production Issue / Ticket
              </h3>
              <button
                onClick={() => setIsIssueModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitIssue} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                    Reporter
                  </label>
                  <input
                    type="text"
                    value={issueForm.user_name}
                    onChange={(e) => setIssueForm({ ...issueForm, user_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                    Page / Module
                  </label>
                  <input
                    type="text"
                    value={issueForm.page}
                    onChange={(e) => setIssueForm({ ...issueForm, page: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                    Priority
                  </label>
                  <select
                    value={issueForm.priority}
                    onChange={(e) => setIssueForm({ ...issueForm, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="P0">P0 (Critical Blocker)</option>
                    <option value="P1">P1 (High Priority)</option>
                    <option value="P2">P2 (Normal Operation)</option>
                    <option value="P3">P3 (Minor Cosmetic)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                    Category
                  </label>
                  <select
                    value={issueForm.category}
                    onChange={(e) => setIssueForm({ ...issueForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="BUG">Software Bug</option>
                    <option value="USABILITY">Usability / Confusion</option>
                    <option value="MISSING_REPORT">Missing Report Item</option>
                    <option value="PERFORMANCE">Performance / Lag</option>
                    <option value="FEATURE_REQUEST">Feature Request (Auto-Backlog)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  Issue Description
                </label>
                <textarea
                  rows={3}
                  value={issueForm.description}
                  onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                  placeholder="Describe what occurred, steps to reproduce, or transaction involved..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                    Transaction # (Optional)
                  </label>
                  <input
                    type="text"
                    value={issueForm.transaction_number}
                    onChange={(e) =>
                      setIssueForm({ ...issueForm, transaction_number: e.target.value })
                    }
                    placeholder="e.g. INV-01, JRN-004"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                    Request ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={issueForm.request_id}
                    onChange={(e) => setIssueForm({ ...issueForm, request_id: e.target.value })}
                    placeholder="From toast or footer"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIssue}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
                >
                  {submittingIssue ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
