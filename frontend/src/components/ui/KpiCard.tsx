"use client";

import React, { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { formatUSD, safeDecimal } from "@/lib/api";

export interface KpiCardProps {
  title: string;
  value: number | string | null | undefined;
  isMoney?: boolean;
  currency?: string;
  secondaryText?: string;
  statusBadge?: ReactNode;
  icon?: LucideIcon;
  iconColor?: "sky" | "emerald" | "amber" | "rose" | "indigo" | "purple" | "slate";
  trend?: {
    value: string | number;
    direction: "up" | "down" | "neutral";
  };
  onClick?: () => void;
  className?: string;
}

export function KpiCard({
  title,
  value,
  isMoney = true,
  currency = "USD",
  secondaryText,
  statusBadge,
  icon: Icon,
  iconColor = "sky",
  trend,
  onClick,
  className = "",
}: KpiCardProps) {
  const iconThemes: Record<string, string> = {
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 border-sky-100 dark:border-sky-900/40",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-100 dark:border-amber-900/40",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border-rose-100 dark:border-rose-900/40",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border-purple-100 dark:border-purple-900/40",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  };

  const formattedDisplay = () => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    if (isMoney) {
      if (typeof value === "number") {
        return formatUSD(value, true);
      }
      return formatUSD(safeDecimal(value, 0), true);
    }
    return String(value);
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs transition-all ${
        onClick ? "cursor-pointer hover:border-sky-500/50 hover:shadow-xs" : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              {title}
            </span>
            {statusBadge}
          </div>

          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums truncate">
            {formattedDisplay()}
          </div>

          {secondaryText && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              {secondaryText}
            </div>
          )}

          {trend && (
            <div className="flex items-center space-x-1 mt-2 text-[11px] font-semibold">
              <span
                className={
                  trend.direction === "up"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : trend.direction === "down"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-500"
                }
              >
                {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "•"} {trend.value}
              </span>
            </div>
          )}
        </div>

        {Icon && (
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${
              iconThemes[iconColor] || iconThemes.sky
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
