"use client";

import React, { useState, useMemo } from "react";
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { TableColumn } from "./types";
import { EmptyState, LoadingState, ErrorState } from "./StateViews";

interface AccountingTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  error?: string | Error | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  stickyHeader?: boolean;
  compact?: boolean;
  pageSize?: number;
  showPagination?: boolean;
  rowKey?: (item: T, idx: number) => string | number;
  onRowClick?: (item: T) => void;
  summaryRow?: React.ReactNode;
  className?: string;
}

export function AccountingTable<T = any>({
  columns,
  data,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "No records available",
  emptyDescription = "There are no accounting records matching the selected parameters.",
  stickyHeader = true,
  compact = false,
  pageSize: initialPageSize = 25,
  showPagination = true,
  rowKey,
  onRowClick,
  summaryRow,
  className = "",
}: AccountingTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a: any, b: any) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortOrder === "asc" ? numA - numB : numB - numA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [data, sortKey, sortOrder]);

  // Pagination
  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pagedData = useMemo(() => {
    if (!showPagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, showPagination]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === "asc") setSortOrder("desc");
      else {
        setSortKey(null);
        setSortOrder("asc");
      }
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const rowPaddingClass = compact ? "py-2 px-3 text-xs" : "py-3 px-3.5 text-xs";

  return (
    <div className={`overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-xs ${className}`}>
      <div className="overflow-x-auto max-w-full">
        <table className="table print-table w-full border-collapse">
          <thead className={stickyHeader ? "sticky top-0 z-10 bg-slate-100 dark:bg-slate-800/90 shadow-2xs" : "bg-slate-100 dark:bg-slate-800"}>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
              {columns.map((col) => {
                const alignClass =
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left";
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={`py-2.5 px-3 select-none ${alignClass} ${
                      col.sortable ? "cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/60" : ""
                    }`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${col.align === "right" ? "justify-end" : ""}`}>
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-slate-400">
                          {sortKey === col.key ? (
                            sortOrder === "asc" ? (
                              <ChevronUp className="w-3.5 h-3.5 text-sky-600" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {pagedData.map((row, idx) => {
              const key = rowKey ? rowKey(row, idx) : idx;
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${
                    idx % 2 === 1 ? "bg-slate-50/40 dark:bg-slate-900/30" : "bg-white dark:bg-slate-900"
                  } ${
                    onRowClick
                      ? "cursor-pointer hover:bg-sky-50/50 dark:hover:bg-sky-950/20"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left";
                    return (
                      <td key={col.key} className={`${rowPaddingClass} ${alignClass} text-slate-800 dark:text-slate-200`}>
                        {col.render ? col.render(row, idx) : (row as any)[col.key] !== undefined ? String((row as any)[col.key]) : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {summaryRow}
          </tbody>
        </table>
      </div>

      {showPagination && totalPages > 1 && (
        <div className="no-print flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="font-semibold text-slate-900 dark:text-slate-100">{(currentPage - 1) * pageSize + 1}</strong> to{" "}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {Math.min(currentPage * pageSize, totalItems)}
              </strong>{" "}
              of <strong className="font-semibold text-slate-900 dark:text-slate-100">{totalItems}</strong> entries
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="ml-2 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-sky-500"
            >
              <option value={15}>15 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
