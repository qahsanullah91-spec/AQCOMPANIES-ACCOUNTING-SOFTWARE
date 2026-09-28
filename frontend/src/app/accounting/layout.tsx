"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Calendar,
  Lock,
  Plus,
  Printer,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { PrintButton } from "@/components/accounting";

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [selectedCompany, setSelectedCompany] = useState("ALL");

  // Determine current section name from path
  const getSectionTitle = () => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length <= 1) return "Overview";
    const sub = parts[1];
    return sub
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <div className="accounting-system-container min-h-screen">
      {/* Top Universal Accounting Status Bar (No-Print) */}
      <div className="no-print bg-slate-900 text-slate-200 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs mb-4 rounded-xl shadow-xs">
        {/* Left: Multi-Company & Breadcrumb */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-sky-400" />
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="ALL">AQ COMPANIES (Consolidated Group)</option>
              <option value="1">AQ TRADING LLC (Dubai)</option>
              <option value="2">AQ LOGISTICS & TRANSPORT (Kabul)</option>
              <option value="3">AQ AGRO COMMODITIES (Delhi)</option>
            </select>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          <div className="hidden sm:flex items-center space-x-1.5 text-slate-400 text-xs font-medium">
            <Link href="/accounting" className="hover:text-white transition-colors">
              Accounting
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-sky-300 font-semibold">{getSectionTitle()}</span>
          </div>
        </div>

        {/* Right: Period & Integrity Status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-mono text-[11px] bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-md">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>GL BALANCED (Variance $0.00)</span>
          </div>

          <div className="flex items-center space-x-1.5 text-slate-300 font-mono text-[11px] bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>FY 2026 • OPEN</span>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              href="/accounting/journal/new"
              className="flex items-center space-x-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-colors text-[11px]"
            >
              <Plus className="w-3 h-3" />
              <span>New Journal</span>
            </Link>
            <PrintButton size="sm" variant="secondary" />
          </div>
        </div>
      </div>

      {/* Main Accounting Content */}
      <main className="accounting-content-shell">{children}</main>
    </div>
  );
}
