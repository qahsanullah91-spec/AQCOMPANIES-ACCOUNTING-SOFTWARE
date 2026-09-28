"use client";

import React from "react";
import { StatusType } from "./types";

interface StatusBadgeProps {
  status: string | StatusType;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ status, label, size = "md", className = "" }: StatusBadgeProps) {
  const norm = String(status || "").toUpperCase();

  const configs: Record<
    string,
    { text: string; bg: string; border: string; dot: string; textColor: string }
  > = {
    POSTED: {
      text: label || "POSTED",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800",
      dot: "bg-emerald-500",
      textColor: "text-emerald-700 dark:text-emerald-300",
    },
    PAID: {
      text: label || "PAID",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800",
      dot: "bg-emerald-500",
      textColor: "text-emerald-700 dark:text-emerald-300",
    },
    RECONCILED: {
      text: label || "RECONCILED",
      bg: "bg-sky-50 dark:bg-sky-950/40",
      border: "border-sky-200 dark:border-sky-800",
      dot: "bg-sky-500",
      textColor: "text-sky-700 dark:text-sky-300",
    },
    DRAFT: {
      text: label || "DRAFT",
      bg: "bg-slate-100 dark:bg-slate-800",
      border: "border-slate-300 dark:border-slate-700",
      dot: "bg-slate-400",
      textColor: "text-slate-700 dark:text-slate-300",
    },
    PENDING: {
      text: label || "PENDING",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800",
      dot: "bg-amber-500",
      textColor: "text-amber-800 dark:text-amber-300",
    },
    PARTIAL: {
      text: label || "PARTIAL",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      border: "border-indigo-200 dark:border-indigo-800",
      dot: "bg-indigo-500",
      textColor: "text-indigo-700 dark:text-indigo-300",
    },
    PARTIALLY_PAID: {
      text: label || "PARTIALLY PAID",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      border: "border-indigo-200 dark:border-indigo-800",
      dot: "bg-indigo-500",
      textColor: "text-indigo-700 dark:text-indigo-300",
    },
    OVERDUE: {
      text: label || "OVERDUE",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      border: "border-rose-200 dark:border-rose-800",
      dot: "bg-rose-500",
      textColor: "text-rose-700 dark:text-rose-300",
    },
    UNPAID: {
      text: label || "UNPAID",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      border: "border-rose-200 dark:border-rose-800",
      dot: "bg-rose-500",
      textColor: "text-rose-700 dark:text-rose-300",
    },
    VOID: {
      text: label || "VOID",
      bg: "bg-slate-200 dark:bg-slate-800",
      border: "border-slate-400 dark:border-slate-600",
      dot: "bg-slate-500",
      textColor: "text-slate-600 dark:text-slate-400 line-through",
    },
    REVERSED: {
      text: label || "REVERSED",
      bg: "bg-slate-100 dark:bg-slate-800",
      border: "border-slate-300 dark:border-slate-700",
      dot: "bg-purple-500",
      textColor: "text-purple-700 dark:text-purple-300",
    },
    CREDIT_IN_FAVOR: {
      text: label || "CREDIT IN FAVOR",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-300 dark:border-emerald-700",
      dot: "bg-emerald-600",
      textColor: "text-emerald-800 dark:text-emerald-200",
    },
    UNRECONCILED: {
      text: label || "UNRECONCILED",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800",
      dot: "bg-amber-500",
      textColor: "text-amber-700 dark:text-amber-300",
    },
    CREDIT: {
      text: label || "CREDIT",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800",
      dot: "bg-emerald-600",
      textColor: "text-emerald-700 dark:text-emerald-300",
    },
    PENDING_COST: {
      text: label || "PENDING COST",
      bg: "bg-amber-100 dark:bg-amber-950/60",
      border: "border-amber-300 dark:border-amber-700",
      dot: "bg-amber-600 animate-pulse",
      textColor: "text-amber-900 dark:text-amber-200",
    },
  };

  const config = configs[norm] || {
    text: label || norm,
    bg: "bg-slate-100 dark:bg-slate-800",
    border: "border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400",
    textColor: "text-slate-700 dark:text-slate-300",
  };

  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide uppercase ${config.bg} ${config.border} ${config.textColor} ${sizeClass} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.text}
    </span>
  );
}
