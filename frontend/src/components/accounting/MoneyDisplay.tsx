"use client";

import React from "react";
import { formatCurrency, formatUSD } from "@/lib/api";

interface MoneyDisplayProps {
  amount: number | string | null | undefined;
  currency?: string;
  type?: "neutral" | "income" | "expense" | "debit" | "credit" | "carrier_credit";
  isCarrierCredit?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showSign?: boolean;
  isPendingCost?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
}

export function MoneyDisplay({
  amount,
  currency = "USD",
  type = "neutral",
  isCarrierCredit = false,
  size = "md",
  showSign = false,
  isPendingCost = false,
  align = "right",
  className = "",
}: MoneyDisplayProps) {
  if (isPendingCost || (amount === null && type === "expense")) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 ${className}`}
      >
        PENDING COST
      </span>
    );
  }

  const num = amount !== null && amount !== undefined && !isNaN(Number(amount)) ? Number(amount) : 0;

  // Handle carrier credit special case (negative balance on carrier ledger = Credit in our favor)
  if ((isCarrierCredit || type === "carrier_credit") && num < 0) {
    const absVal = Math.abs(num);
    return (
      <div className={`inline-flex flex-col items-${align === "right" ? "end" : align === "left" ? "start" : "center"} ${className}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          CREDIT IN AQ FAVOR
        </span>
        <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-300 text-sm">
          {formatCurrency(absVal, currency)}
        </span>
      </div>
    );
  }

  // Size map
  const sizeClasses = {
    xs: "text-xs font-medium",
    sm: "text-xs font-semibold",
    md: "text-sm font-semibold",
    lg: "text-base font-bold",
    xl: "text-xl font-bold tracking-tight",
  };

  // Color map
  let colorClass = "text-slate-900 dark:text-slate-100";
  let signPrefix = "";

  if (type === "income" || type === "debit") {
    colorClass = num > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400";
    if (showSign && num > 0) signPrefix = "+";
  } else if (type === "expense" || type === "credit") {
    colorClass = num > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400";
    if (showSign && num > 0) signPrefix = "-";
  } else if (num < 0) {
    colorClass = "text-rose-600 dark:text-rose-400";
  }

  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const formatted = formatCurrency(Math.abs(num), currency);
  const displayVal = num < 0 ? `-${formatted}` : `${signPrefix}${formatted}`;

  return (
    <span
      className={`font-mono tabular-nums ${sizeClasses[size]} ${colorClass} ${alignClass} ${className}`}
      title={currency !== "USD" ? `${num.toLocaleString()} ${currency}` : undefined}
    >
      {displayVal}
    </span>
  );
}
