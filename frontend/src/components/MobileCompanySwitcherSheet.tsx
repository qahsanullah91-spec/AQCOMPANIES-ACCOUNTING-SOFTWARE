"use client";

import React, { useState, useEffect } from "react";
import { Building2, Check, X, ShieldCheck, Globe, ChevronRight } from "lucide-react";
import { API_BASE, fetchApi } from "@/lib/api";

interface CompanyItem {
  id: number | string;
  company_code: string;
  company_name: string;
  base_currency: string;
  country?: string;
  status?: string;
}

interface MobileCompanySwitcherSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanySelected?: (company: CompanyItem) => void;
}

const DEFAULT_COMPANIES: CompanyItem[] = [
  {
    id: 1,
    company_code: "AQC",
    company_name: "AQ COMPANIES",
    base_currency: "USD",
    country: "UAE",
    status: "ACTIVE",
  },
  {
    id: 2,
    company_code: "NAL",
    company_name: "NAJEB AMIN LTD",
    base_currency: "USD",
    country: "AFG",
    status: "ACTIVE",
  },
  {
    id: 3,
    company_code: "SAL",
    company_name: "SKY ARIANA LTD",
    base_currency: "USD",
    country: "AFG",
    status: "ACTIVE",
  },
];

export function MobileCompanySwitcherSheet({
  isOpen,
  onClose,
  onCompanySelected,
}: MobileCompanySwitcherSheetProps) {
  const [companies, setCompanies] = useState<CompanyItem[]>(DEFAULT_COMPANIES);
  const [activeCompanyName, setActiveCompanyName] = useState<string>("AQ COMPANIES");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aq_active_company");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setActiveCompanyName(parsed.company_name || parsed);
        } catch {
          setActiveCompanyName(saved);
        }
      }
    }

    const loadCompanies = async () => {
      try {
        setLoading(true);
        const res: any = await fetchApi("/companies").catch(() => null);
        if (res?.companies && Array.isArray(res.companies) && res.companies.length > 0) {
          setCompanies(res.companies);
        }
      } catch (e) {
        // Fallback to default companies
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadCompanies();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (company: CompanyItem) => {
    setActiveCompanyName(company.company_name);
    if (typeof window !== "undefined") {
      localStorage.setItem("aq_active_company", JSON.stringify(company));
      window.dispatchEvent(
        new CustomEvent("aq_company_changed", { detail: company })
      );
    }
    if (onCompanySelected) {
      onCompanySelected(company);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="w-full sm:max-w-md bg-white dark:bg-[#111827] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] max-h-[85dvh] animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Operating Company Context
              </h2>
              <p className="text-[11px] text-slate-500">
                Authorized multi-company access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company Warning Banner (Req 47) */}
        <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] flex items-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Financial entries, ledgers & vouchers will post strictly to the selected company.
          </span>
        </div>

        {/* Company List */}
        <div className="p-4 space-y-2 overflow-y-auto">
          {companies.map((c) => {
            const isSelected =
              activeCompanyName.toLowerCase() === c.company_name.toLowerCase() ||
              activeCompanyName.toLowerCase() === c.company_code.toLowerCase();

            return (
              <button
                key={c.id || c.company_code}
                type="button"
                onClick={() => handleSelect(c)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between active:scale-[0.99] ${
                  isSelected
                    ? "bg-sky-50 dark:bg-sky-950/30 border-sky-500/50 shadow-xs"
                    : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      isSelected
                        ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {c.company_code || "AQ"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {c.company_name}
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-700 dark:text-sky-300">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>Base: {c.base_currency || "USD"}</span>
                      {c.country && <span>• {c.country}</span>}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 ml-2">
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
