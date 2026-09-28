"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, ChevronDown, ArrowLeft, User } from "lucide-react";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { MobileCompanySwitcherSheet } from "./MobileCompanySwitcherSheet";

// Helper to determine clean, concise module title from pathname
function getModuleTitle(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/approvals")) return "Approvals";
  if (pathname.startsWith("/receivables/payments")) return "Receipts";
  if (pathname.startsWith("/receivables")) return "Receivables";
  if (pathname.startsWith("/banking/transactions")) return "Bank Ledger";
  if (pathname.startsWith("/banking/accounts")) return "Bank Accounts";
  if (pathname.startsWith("/banking/reconciliation")) return "Reconcile";
  if (pathname.startsWith("/banking/unmatched")) return "Bank Queue";
  if (pathname.startsWith("/banking/import")) return "Statement Import";
  if (pathname.startsWith("/banking")) return "Banking";
  if (pathname.startsWith("/accounting/general-ledger")) return "General Ledger";
  if (pathname.startsWith("/accounting/trial-balance")) return "Trial Balance";
  if (pathname.startsWith("/accounting/profit-loss") || pathname.startsWith("/profit-and-loss"))
    return "Profit & Loss";
  if (pathname.startsWith("/accounting/balance-sheet")) return "Balance Sheet";
  if (pathname.startsWith("/accounting/cash-flow")) return "Cash Flow";
  if (pathname.startsWith("/accounting/cashbook")) return "Cashbook";
  if (pathname.startsWith("/accounting/allocation")) return "Allocation";
  if (pathname.startsWith("/accounting/daily")) return "Daily Journal";
  if (pathname.startsWith("/accounting/statements")) return "Statements";
  if (pathname.startsWith("/accounting/audit-log")) return "Audit Trail";
  if (pathname.startsWith("/accounting/chart-of-accounts")) return "Chart of Accounts";
  if (pathname.startsWith("/accounting")) return "Accounting";
  if (pathname.startsWith("/payables")) return "Payables";
  if (pathname.startsWith("/payments")) return "Payments";
  if (pathname.startsWith("/transport/account")) return "Transport Account";
  if (pathname.startsWith("/transport")) return "Transport";
  if (pathname.startsWith("/shipments")) return "Shipments";
  if (pathname.startsWith("/invoices")) return "Invoices";
  if (pathname.startsWith("/purchases")) return "Purchases";
  if (pathname.startsWith("/new-stock")) return "New Stock";
  if (pathname.startsWith("/customers")) return "Customers";
  if (pathname.startsWith("/suppliers")) return "Suppliers";
  if (pathname.startsWith("/expenses")) return "Expenses";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/backup")) return "Backup";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/notifications")) return "Notifications";
  return "AQ Companies";
}

interface MobileTopHeaderProps {
  onOpenMore?: () => void;
}

export function MobileTopHeader({ onOpenMore }: MobileTopHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [companySheetOpen, setCompanySheetOpen] = useState(false);
  const [activeCompany, setActiveCompany] = useState("AQ COMPANIES");

  const isDeepRoute = pathname !== "/" && pathname !== "/dashboard";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aq_active_company");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setActiveCompany(parsed.company_name || parsed);
        } catch {
          setActiveCompany(saved);
        }
      }

      const handleCompanyChange = (e: any) => {
        if (e.detail?.company_name) {
          setActiveCompany(e.detail.company_name);
        }
      };

      window.addEventListener("aq_company_changed", handleCompanyChange);
      return () => window.removeEventListener("aq_company_changed", handleCompanyChange);
    }
  }, []);

  const title = getModuleTitle(pathname);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 pt-safe transition-colors no-print">
        <div className="h-12 px-3 flex items-center justify-between gap-1.5 max-w-full">
          {/* LEFT: [ AQ ] or [ Back ] navigation (Req 3) */}
          <div className="flex items-center space-x-1 shrink-0">
            {isDeepRoute ? (
              <button
                type="button"
                onClick={() => router.back()}
                className="w-10 h-10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                aria-label="Navigate Back"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
              </button>
            ) : null}

            <Link
              href="/"
              className="flex items-center shrink-0 active:scale-95 transition-transform min-w-[36px] min-h-[36px]"
              aria-label="AQ Companies Home"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-sky-600/30 tracking-tight">
                AQ
              </div>
            </Link>
          </div>

          {/* CENTER: Page Title (Compact, single line, no desktop breadcrumbs) */}
          <div className="flex-1 min-w-0 text-center px-1">
            <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white truncate leading-tight">
              {title}
            </h1>
            <button
              type="button"
              onClick={() => setCompanySheetOpen(true)}
              className="inline-flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 font-bold tracking-wider uppercase truncate active:scale-95 transition-transform"
              title="Switch Operating Company"
            >
              <span className="truncate max-w-[130px]">{activeCompany}</span>
              <ChevronDown className="w-2.5 h-2.5 shrink-0" />
            </button>
          </div>

          {/* RIGHT: [ Search ] [ User ] (Req 3: exactly Search and User) */}
          <div className="flex items-center space-x-1 shrink-0">
            {/* Search Button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-10 h-10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              aria-label="Search"
              title="Global Search"
            >
              <Search className="w-4 h-4 stroke-[2]" />
            </button>

            {/* User Profile / Settings Button */}
            <Link
              href="/settings"
              className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center active:scale-95 cursor-pointer"
              aria-label="User Profile & Settings"
              title="User Profile & Settings"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-black text-[11px] flex items-center justify-center border border-sky-300 dark:border-sky-700">
                AQ
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile Company Switcher Bottom Sheet */}
      <MobileCompanySwitcherSheet
        isOpen={companySheetOpen}
        onClose={() => setCompanySheetOpen(false)}
      />
    </>
  );
}
