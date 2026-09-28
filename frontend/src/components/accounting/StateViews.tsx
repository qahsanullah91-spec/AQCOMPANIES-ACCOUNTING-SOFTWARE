"use client";

import React, { ReactNode } from "react";
import { AlertCircle, FileSearch, Loader2, RefreshCw } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title = "No records found",
  description = "No matching transactions or data available for this view.",
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 ${className}`}
    >
      <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-xs border border-slate-200 dark:border-slate-700 text-slate-400 mb-3">
        {icon || <FileSearch className="w-6 h-6" />}
      </div>
      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
        {title}
      </h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
        {description}
      </p>
      {action}
    </div>
  );
}

interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function LoadingState({
  title = "Loading data...",
  description = "Retrieving verified accounting records from the authoritative ledger.",
  className = "",
}: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-10 sm:p-16 text-center ${className}`}
    >
      <Loader2 className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-spin mb-3" />
      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
        {title}
      </h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
        {description}
      </p>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  error: string | Error;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Failed to load accounting data",
  error,
  onRetry,
  className = "",
}: ErrorStateProps) {
  const errMsg = typeof error === "string" ? error : error?.message || "Unknown error occurred.";

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 ${className}`}
    >
      <div className="p-3 bg-rose-100 dark:bg-rose-900/60 rounded-full text-rose-600 dark:text-rose-400 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200 mb-1">
        {title}
      </h4>
      <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md font-mono mb-4 break-words">
        {errMsg}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Operation</span>
        </button>
      )}
    </div>
  );
}
