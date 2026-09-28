"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  ShieldAlert,
  Archive,
  Landmark,
  DollarSign,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Filter,
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface NotificationItem {
  id: number;
  category: string;
  title: string;
  message: string;
  link?: string;
  severity: "INFO" | "WARNING" | "DANGER" | "SUCCESS";
  status: "UNREAD" | "READ" | "DISMISSED";
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const loadNotifications = async () => {
    try {
      setLoading(true);
      let url = "/notifications?limit=100";
      if (categoryFilter !== "ALL") url += `&category=${categoryFilter}`;
      if (statusFilter !== "ALL") url += `&status=${statusFilter}`;
      const data = await fetchApi<NotificationItem[]>(url);
      setNotifications(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [categoryFilter, statusFilter]);

  const handleMarkRead = async (id: number) => {
    try {
      await fetchApi(`/notifications/${id}/read`, { method: "PUT" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "READ" } : n))
      );
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDismiss = async (id: number) => {
    try {
      await fetchApi(`/notifications/${id}/dismiss`, { method: "PUT" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err: any) {
      console.error(err);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "APPROVAL":
        return <ShieldAlert className="w-5 h-5 text-amber-500" />;
      case "BANKING":
        return <Landmark className="w-5 h-5 text-sky-500" />;
      case "RECEIVABLES":
        return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case "PAYABLES":
        return <DollarSign className="w-5 h-5 text-rose-500" />;
      case "BACKUP":
      case "SYSTEM":
        return <Archive className="w-5 h-5 text-purple-500" />;
      case "ACCOUNTING":
      default:
        return <DollarSign className="w-5 h-5 text-emerald-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "DANGER":
        return "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200";
      case "WARNING":
        return "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200";
      case "SUCCESS":
        return "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200";
      case "INFO":
      default:
        return "bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border-sky-200";
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Bell className="w-7 h-7 text-indigo-600" />
            Financial Notification Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Automated alerts for missing purchase invoices, wire threshold approvals, and system events
          </p>
        </div>

        <button
          onClick={loadNotifications}
          className="btn btn-secondary text-xs flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Filters (Req 42: Approvals, Banking, Receivables, Payables, Accounting, System) */}
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-500 mr-1">
          <Filter className="w-3.5 h-3.5" /> Category:
        </div>
        {["ALL", "APPROVAL", "BANKING", "RECEIVABLES", "PAYABLES", "ACCOUNTING", "SYSTEM"].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              categoryFilter === cat
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            {cat}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNREAD">Unread Only</option>
            <option value="READ">Read</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading && notifications.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="card p-12 text-center text-slate-400 space-y-2">
            <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
            <div className="font-semibold">No notifications match your current filter</div>
            <div className="text-xs">All financial approvals and alerts are up to date.</div>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`card p-4 border transition-all flex items-start justify-between gap-4 ${
                n.status === "UNREAD"
                  ? "bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900/60 shadow-xs"
                  : "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                  {getCategoryIcon(n.category)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSeverityBadge(
                        n.severity
                      )}`}
                    >
                      {n.category}
                    </span>
                    {n.status === "UNREAD" && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {n.message}
                  </p>

                  <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-400">
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                    {n.link && (
                      <Link
                        href={n.link}
                        className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                      >
                        View Details <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {n.status === "UNREAD" && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg transition-colors"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(n.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
                  title="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
