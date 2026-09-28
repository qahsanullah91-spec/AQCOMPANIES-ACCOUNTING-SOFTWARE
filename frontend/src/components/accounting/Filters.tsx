"use client";

import React from "react";
import { Building2, Calendar } from "lucide-react";

interface CompanyFilterProps {
  selectedCompanyId?: number | string | null;
  onSelectCompany: (companyId: number | null) => void;
  companies?: { id: number; name: string }[];
  className?: string;
}

export function CompanyFilter({
  selectedCompanyId,
  onSelectCompany,
  companies = [
    { id: 1, name: "AQ COMPANIES — Kabul / UAE" },
    { id: 2, name: "NAJEB AMIN LTD — India" },
  ],
  className = "",
}: CompanyFilterProps) {
  return (
    <div className={`flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs ${className}`}>
      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <select
        value={selectedCompanyId !== null && selectedCompanyId !== undefined ? selectedCompanyId : ""}
        onChange={(e) => onSelectCompany(e.target.value ? Number(e.target.value) : null)}
        className="bg-transparent border-0 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:ring-0 p-0 cursor-pointer"
      >
        <option value="">All Companies (Consolidated)</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

interface DateRangeFilterProps {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  className?: string;
}

export function DateRangeFilter({ from, to, onChange, className = "" }: DateRangeFilterProps) {
  return (
    <div className={`flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs ${className}`}>
      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <input
        type="date"
        value={from}
        onChange={(e) => onChange({ from: e.target.value, to })}
        className="bg-transparent border-0 text-slate-800 dark:text-slate-200 text-xs focus:ring-0 p-0"
        title="Start date"
      />
      <span className="text-slate-400 text-xs">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange({ from, to: e.target.value })}
        className="bg-transparent border-0 text-slate-800 dark:text-slate-200 text-xs focus:ring-0 p-0"
        title="End date"
      />
    </div>
  );
}
