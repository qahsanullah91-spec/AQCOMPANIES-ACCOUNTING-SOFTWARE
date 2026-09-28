import React from "react";

export default function BankingLoading() {
  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div className="h-3 w-80 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
        </div>
      </div>

      {/* Nav Skeleton */}
      <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/40 rounded-xl"></div>

      {/* Banner Skeleton */}
      <div className="h-24 w-full bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800"></div>

      {/* Multi-Currency Balances Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-5 space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div className="h-7 w-36 bg-slate-300 dark:bg-slate-700 rounded-lg"></div>
            <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
          </div>
        ))}
      </div>

      {/* Accounts Table Skeleton */}
      <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div className="h-4 w-56 bg-slate-200 dark:bg-slate-800 rounded"></div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800/60">
              <div className="space-y-1 w-1/3">
                <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-2 w-1/2 bg-slate-100 dark:bg-slate-800/40 rounded"></div>
              </div>
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
