"use client";

import React from "react";

interface CurrencyBadgeProps {
  currency: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function CurrencyBadge({ currency = "USD", size = "sm", className = "" }: CurrencyBadgeProps) {
  const curr = String(currency || "USD").toUpperCase();

  const configs: Record<string, { label: string; badgeClass: string }> = {
    USD: {
      label: "USD",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    },
    AFN: {
      label: "AFN",
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    },
    AED: {
      label: "AED",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    },
    INR: {
      label: "INR",
      badgeClass: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    },
  };

  const config = configs[curr] || {
    label: curr,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  };

  const sizeClasses = {
    xs: "px-1.5 py-0.2 text-[10px]",
    sm: "px-2 py-0.5 text-xs font-mono font-bold",
    md: "px-2.5 py-1 text-xs font-mono font-bold",
  };

  return (
    <span
      className={`inline-flex items-center rounded border tracking-wider uppercase font-semibold ${config.badgeClass} ${sizeClasses[size]} ${className}`}
    >
      {config.label}
    </span>
  );
}
