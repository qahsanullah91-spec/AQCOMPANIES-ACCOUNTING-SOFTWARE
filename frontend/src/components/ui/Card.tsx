"use client";

import React, { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  title?: string | ReactNode;
  subtitle?: string | ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: "sky" | "emerald" | "amber" | "rose" | "indigo" | "purple" | "slate";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
}

export function Card({
  children,
  title,
  subtitle,
  action,
  badge,
  icon: Icon,
  iconColor = "sky",
  padding = "md",
  className = "",
}: CardProps) {
  const paddingMap = {
    none: "",
    sm: "p-3",
    md: "p-4 sm:p-5",
    lg: "p-6",
  };

  const iconThemes: Record<string, string> = {
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };

  const hasHeader = Boolean(title || subtitle || action || badge || Icon);

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs transition-colors overflow-hidden ${className}`}
    >
      {hasHeader && (
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            {Icon && (
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  iconThemes[iconColor] || iconThemes.sky
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                {typeof title === "string" ? (
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
                    {title}
                  </h3>
                ) : (
                  title
                )}
                {badge}
              </div>
              {subtitle && typeof subtitle === "string" ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {subtitle}
                </p>
              ) : (
                subtitle
              )}
            </div>
          </div>

          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      <div className={paddingMap[padding]}>{children}</div>
    </div>
  );
}
