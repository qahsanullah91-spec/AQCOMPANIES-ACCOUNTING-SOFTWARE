"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LucideIcon } from "lucide-react";

export interface NavTabItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: string | number;
}

interface SecondaryNavProps {
  primaryTabs: NavTabItem[];
  moreTabs?: NavTabItem[];
  maxVisibleTabs?: number;
  className?: string;
  activeColor?: "sky" | "emerald" | "indigo" | "amber";
}

export function SecondaryNav({
  primaryTabs,
  moreTabs = [],
  maxVisibleTabs = 6,
  className = "",
  activeColor = "sky",
}: SecondaryNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Split tabs if primaryTabs exceed maxVisibleTabs
  const visiblePrimary = primaryTabs.slice(0, maxVisibleTabs);
  const overflowTabs = [...primaryTabs.slice(maxVisibleTabs), ...moreTabs];

  const isMoreActive = overflowTabs.some(
    (tab) => pathname === tab.href || pathname.startsWith(tab.href + "/")
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const activeStyles: Record<string, string> = {
    sky: "bg-sky-600 text-white shadow-xs font-bold",
    emerald: "bg-emerald-600 text-white shadow-xs font-bold",
    indigo: "bg-indigo-600 text-white shadow-xs font-bold",
    amber: "bg-amber-600 text-white shadow-xs font-bold",
  };

  const activeBadgeStyles: Record<string, string> = {
    sky: "bg-white text-sky-600",
    emerald: "bg-white text-emerald-600",
    indigo: "bg-white text-indigo-600",
    amber: "bg-white text-amber-600",
  };

  return (
    <div
      className={`border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl px-2 py-1 shadow-2xs mb-6 no-print overflow-hidden select-none ${className}`}
    >
      <div className="flex items-center justify-between gap-1 overflow-x-auto scrollbar-none py-0.5">
        {/* Visible Primary Tabs */}
        <div className="flex items-center space-x-1 shrink-0">
          {visiblePrimary.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? activeStyles[activeColor]
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                }`}
              >
                {Icon && (
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? "text-white" : "text-slate-400"
                    }`}
                  />
                )}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? activeBadgeStyles[activeColor]
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* More Dropdown (if overflow exists) */}
        {overflowTabs.length > 0 && (
          <div className="relative shrink-0" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                isMoreActive
                  ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <span>More</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {moreOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  Additional Views
                </div>
                {overflowTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");

                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                        isActive
                          ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-bold"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        <span>{tab.label}</span>
                      </div>
                      {tab.badge !== undefined && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {tab.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
