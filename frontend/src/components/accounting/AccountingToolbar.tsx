"use client";

import React, { useState, ReactNode } from "react";
import {
  Search,
  X,
  FileSpreadsheet,
  RotateCcw,
  Filter,
  MoreHorizontal,
  Printer,
  RefreshCw,
} from "lucide-react";
import { PrintButton } from "./PrintButton";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";

interface AccountingToolbarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  dateRange?: { from: string; to: string };
  onDateRangeChange?: (range: { from: string; to: string }) => void;
  onResetFilters?: () => void;
  onExportCsv?: () => void;
  exportCsvLabel?: string;
  showPrint?: boolean;
  onPrint?: () => void;
  onRefresh?: () => void;
  extraFilters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AccountingToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search ledger, references, parties...",
  dateRange,
  onDateRangeChange,
  onResetFilters,
  onExportCsv,
  exportCsvLabel = "Export CSV",
  showPrint = true,
  onPrint,
  onRefresh,
  extraFilters,
  actions,
  className = "",
}: AccountingToolbarProps) {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const setQuickDate = (type: "today" | "this_month" | "last_month" | "all") => {
    if (!onDateRangeChange) return;
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (type === "today") {
      const s = fmt(today);
      onDateRangeChange({ from: s, to: s });
    } else if (type === "this_month") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      onDateRangeChange({ from: fmt(first), to: fmt(today) });
    } else if (type === "last_month") {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      onDateRangeChange({ from: fmt(first), to: fmt(last) });
    } else {
      onDateRangeChange({ from: "", to: "" });
    }
  };

  const hasActiveFilters = Boolean(
    (search && search.trim().length > 0) ||
    (dateRange && (dateRange.from || dateRange.to))
  );

  return (
    <>
      {/* =========================================================
          MOBILE VIEWPORT TOOLBAR (< lg)
          Requirement 40: [Filters] [Export] [⋯]
          ========================================================= */}
      <div className="lg:hidden no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 mb-4 shadow-xs space-y-2.5">
        {/* Full-width Search Bar */}
        {onSearchChange !== undefined && (
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-9 py-2 text-base bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Action Controls Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Filters Button */}
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors min-h-[44px] cursor-pointer ${
              hasActiveFilters
                ? "bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0" />
            )}
          </button>

          {/* Export CSV Button (if available) */}
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 min-h-[44px] cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export</span>
            </button>
          )}

          {/* More Actions [⋯] Button */}
          <button
            type="button"
            onClick={() => setMobileMoreOpen(true)}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="More report actions"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Filters Bottom Sheet */}
      <MobileBottomSheet
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title="Filter Records"
        subtitle="Adjust date ranges and parameters"
        footer={
          <div className="flex items-center gap-2">
            {onResetFilters && (
              <button
                type="button"
                onClick={() => {
                  onResetFilters();
                  setMobileFilterOpen(false);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold min-h-[44px]"
              >
                Clear Filters
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileFilterOpen(false)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-sky-600 text-white text-xs font-bold min-h-[44px]"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {dateRange && onDateRangeChange && (
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">From</span>
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
                    className="w-full px-3 py-2 text-base rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">To</span>
                  <input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
                    className="w-full px-3 py-2 text-base rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setQuickDate("today")}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate("this_month")}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate("last_month")}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate("all")}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  All Time
                </button>
              </div>
            </div>
          )}

          {extraFilters}
        </div>
      </MobileBottomSheet>

      {/* Mobile More Actions Bottom Sheet */}
      <MobileBottomSheet
        isOpen={mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
        title="Report Actions"
      >
        <div className="space-y-2 py-2">
          {onRefresh && (
            <button
              type="button"
              onClick={() => {
                onRefresh();
                setMobileMoreOpen(false);
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 min-h-[46px]"
            >
              <RefreshCw className="w-4 h-4 text-sky-600" />
              <span>Refresh Records</span>
            </button>
          )}

          {showPrint && (
            <button
              type="button"
              onClick={() => {
                if (onPrint) onPrint();
                else window.print();
                setMobileMoreOpen(false);
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 min-h-[46px]"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print Clean Report</span>
            </button>
          )}

          {onExportCsv && (
            <button
              type="button"
              onClick={() => {
                onExportCsv();
                setMobileMoreOpen(false);
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 min-h-[46px]"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Download CSV Spreadsheet</span>
            </button>
          )}

          {actions}
        </div>
      </MobileBottomSheet>

      {/* =========================================================
          DESKTOP VIEWPORT TOOLBAR (>= lg)
          Unchanged desktop layout
          ========================================================= */}
      <div
        className={`hidden lg:flex no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 mb-6 shadow-xs flex-col lg:flex-row lg:items-center justify-between gap-3 ${className}`}
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {onSearchChange !== undefined && (
            <div className="relative min-w-[220px] max-w-sm flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {dateRange && onDateRangeChange && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-xs">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
                className="bg-transparent border-0 text-slate-800 dark:text-slate-200 text-xs focus:ring-0 px-1.5 py-0.5"
                title="From date"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
                className="bg-transparent border-0 text-slate-800 dark:text-slate-200 text-xs focus:ring-0 px-1.5 py-0.5"
                title="To date"
              />
              <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700 text-[10px]">
                <button
                  type="button"
                  onClick={() => setQuickDate("this_month")}
                  className="px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate("all")}
                  className="px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  All
                </button>
              </div>
            </div>
          )}

          {extraFilters}

          {onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Reset filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors cursor-pointer"
              title="Export filtered table as CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{exportCsvLabel}</span>
            </button>
          )}

          {showPrint && <PrintButton onBeforePrint={onPrint} size="sm" />}

          {actions}
        </div>
      </div>
    </>
  );
}
