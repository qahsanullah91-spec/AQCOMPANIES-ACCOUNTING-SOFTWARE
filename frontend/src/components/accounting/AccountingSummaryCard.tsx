"use client";

import React, { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { MoneyDisplay } from "./MoneyDisplay";

interface AccountingSummaryCardProps {
  title: string;
  amount?: number | string | null;
  value?: number | string | null | ReactNode;
  currency?: string;
  isMoney?: boolean;
  moneyType?: "neutral" | "income" | "expense" | "carrier_credit";
  customValue?: ReactNode;
  subtitle?: string;
  badge?: ReactNode;
  trend?: { direction: string; label: string };
  icon?: LucideIcon;
  iconColor?: "sky" | "emerald" | "amber" | "rose" | "indigo" | "purple" | "slate";
  onClick?: () => void;
  className?: string;
}

export function AccountingSummaryCard({
  title,
  amount,
  value,
  currency = "USD",
  isMoney = true,
  moneyType = "neutral",
  customValue,
  subtitle,
  badge,
  trend,
  icon: Icon,
  iconColor = "sky",
  onClick,
  className = "",
}: AccountingSummaryCardProps) {
  const actualAmount =
    amount !== undefined
      ? amount
      : typeof value === "number" || typeof value === "string"
      ? value
      : null;
  const actualCustom =
    customValue !== undefined
      ? customValue
      : typeof value !== "number" && typeof value !== "string"
      ? value
      : null;
  const colorConfigs = {
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };

  return (
    <div
      onClick={onClick}
      className={`card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs transition-all ${
        onClick ? "cursor-pointer hover:border-sky-400 dark:hover:border-sky-600 hover:shadow-sm" : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
          {title}
        </span>
        {Icon && (
          <div className={`p-2 rounded-lg ${colorConfigs[iconColor]} shrink-0`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1">
        {actualCustom ? (
          actualCustom
        ) : isMoney ? (
          <MoneyDisplay
            amount={actualAmount}
            currency={currency}
            type={moneyType}
            size="xl"
            align="left"
          />
        ) : (
          <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
            {actualAmount !== undefined && actualAmount !== null ? actualAmount : "—"}
          </span>
        )}
        {badge || (trend && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              trend.direction === "up"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
            }`}
          >
            {trend.label}
          </span>
        ))}
      </div>

      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
}
