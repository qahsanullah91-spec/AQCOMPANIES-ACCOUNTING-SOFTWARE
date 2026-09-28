"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Landmark,
  Layers,
  ArrowLeftRight,
  Scale,
  Receipt,
  Building2,
  Truck,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";

export function BankingNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const primaryTabs = [
    { label: "Customer Receipts", href: "/receivables/payments", icon: Receipt },
    { label: "Bank Transactions", href: "/banking/transactions", icon: ArrowLeftRight },
    { label: "Reconciliation", href: "/banking/reconciliation", icon: Scale },
    { label: "SWIFT MT103", href: "/banking/mt103", icon: Receipt },
    { label: "Unmatched Queue", href: "/banking/unmatched", icon: Scale },
    { label: "Audit Trail", href: "/accounting/audit-log", icon: ShieldCheck },
  ];

  const secondaryTabs = [
    { label: "Banking Hub", href: "/banking", icon: Landmark },
    { label: "Bank Accounts Master", href: "/banking/accounts", icon: Layers },
    { label: "Statement Import", href: "/banking/import", icon: ArrowLeftRight },
    { label: "Supplier Payments", href: "/payables", icon: Building2 },
    { label: "Transport Account", href: "/transport/account", icon: Truck },
  ];

  const isSecondaryActive = secondaryTabs.some((tab) => pathname === tab.href);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl px-2 py-1 shadow-2xs mb-6 no-print">
      <div className="flex items-center justify-between gap-1 flex-wrap">
        {/* Primary Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto py-0.5">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        {/* More Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              isSecondaryActive
                ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <span>More</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {moreOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                Additional Banking
              </div>
              {secondaryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center space-x-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
