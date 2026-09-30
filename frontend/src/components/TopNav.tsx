"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Search,
  Plus,
  Moon,
  Sun,
  ChevronDown,
  Building2,
  Layers,
  Check,
  ExternalLink,
  Bell,
  User,
  Settings as SettingsIcon,
  LogOut,
  CreditCard,
  Truck,
  Wallet,
  Receipt,
  ShoppingBag,
  Ship,
  FileText,
  ChevronRight,
  Lock,
} from "lucide-react";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/api";

interface Company {
  id: number;
  company_code: string;
  company_name: string;
  legal_name?: string;
  color_accent?: string;
  status: string;
}

export function TopNav() {
  const pathname = usePathname();
  const { isDark, toggleTheme } = useTheme();
  const { user, lockSession, logout } = useAuth();

  // Modals & Dropdowns
  const [searchOpen, setSearchOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // References for outside click dismissal
  const newMenuRef = useRef<HTMLDivElement>(null);
  const companyMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Companies Master
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<number>(0); // 0 = Consolidated / All

  // Fetch Companies on Mount
  useEffect(() => {
    fetch(`${API_BASE}/companies`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.companies) {
          setCompanies(data.companies);
        }
      })
      .catch((err) => console.error("Could not fetch companies:", err));

    const saved = localStorage.getItem("aq_active_company_id");
    if (saved !== null) {
      setActiveCompanyId(parseInt(saved, 10));
    }
  }, []);

  // Listen for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
      if (companyMenuRef.current && !companyMenuRef.current.contains(e.target as Node)) {
        setCompanyMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdowns on route change
  useEffect(() => {
    setNewMenuOpen(false);
    setCompanyMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  const handleSelectCompany = (id: number) => {
    setActiveCompanyId(id);
    localStorage.setItem("aq_active_company_id", id.toString());
    setCompanyMenuOpen(false);
    window.dispatchEvent(new CustomEvent("aq_company_changed", { detail: { company_id: id } }));
  };

  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  // Compute breadcrumb / module title from pathname
  const getBreadcrumb = () => {
    if (pathname === "/" || pathname === "/dashboard") {
      return { section: "Overview", page: "Dashboard" };
    }
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return { section: "Overview", page: "Dashboard" };

    const sectionMap: Record<string, string> = {
      accounting: "Accounting",
      banking: "Banking",
      receivables: "Receivables",
      payables: "Payables",
      transport: "Transport",
      shipments: "Operations",
      purchases: "Operations",
      invoices: "Operations",
      "new-stock": "Operations",
      customers: "Master Data",
      suppliers: "Master Data",
      settings: "System",
      backup: "System",
      reports: "Reports",
      treasury: "Finance & Treasury",
    };

    const section = sectionMap[parts[0]] || parts[0].toUpperCase();
    const pageName = parts[parts.length - 1]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    return { section, page: pageName };
  };

  const breadcrumb = getBreadcrumb();

  return (
    <>
      {/* MOBILE COMPACT HEADER (iPhone / Mobile Viewports < lg) */}
      <header className="lg:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 pt-safe sticky top-0 z-30 shadow-2xs no-print select-none">
        <div className="h-12 flex items-center justify-between gap-2">
          {/* LEFT: AQ Logo / Badge */}
          <Link href="/" className="flex items-center space-x-1.5 shrink-0 active:scale-95 transition-transform">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-black text-white text-xs shadow-xs tracking-wider">
              AQ
            </div>
          </Link>

          {/* CENTER: Current Module Title */}
          <div className="flex-1 text-center truncate px-2">
            <h1 className="text-sm font-black text-slate-900 dark:text-white truncate tracking-tight">
              {breadcrumb.page}
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate -mt-0.5">
              {breadcrumb.section}
            </p>
          </div>

          {/* RIGHT: Search, Notifications, + NEW */}
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
              title="Search"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => alert("All ledger and financial sync tasks are healthy.")}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative active:scale-95"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
            </button>

            <button
              type="button"
              onClick={() => setNewMenuOpen(!newMenuOpen)}
              className="p-2 rounded-xl bg-sky-600 text-white shadow-xs active:scale-95 transition-transform ml-0.5"
              title="Quick Action Menu"
              aria-label="Quick Action Menu"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </header>

      {/* DESKTOP HEADER (>= lg) */}
      <header className="hidden lg:flex h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 items-center justify-between sticky top-0 z-30 shadow-2xs no-print select-none">
        {/* LEFT: Mobile Drawer Toggle & Breadcrumb Module Indicator */}
        <div className="flex items-center space-x-3 shrink-0">
          {/* Breadcrumb Module Path */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              {breadcrumb.section}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="font-bold text-slate-900 dark:text-white">
              {breadcrumb.page}
            </span>
          </div>
        </div>

        {/* CENTER / FLEXIBLE: Global Search Bar */}
        <div className="flex-1 max-w-md mx-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs"
            title="Search transactions, customers, BL (Ctrl+K)"
          >
            <div className="flex items-center space-x-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Search invoices, containers, BL, customers...</span>
            </div>
            <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-700 text-slate-500 shrink-0 ml-2 shadow-2xs">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* RIGHT ACTION CLUSTER: +NEW, Notifications, Theme, Company, User */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* 1. + NEW Action Menu Dropdown */}
          <div className="relative" ref={newMenuRef}>
            <button
              type="button"
              onClick={() => setNewMenuOpen(!newMenuOpen)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-colors"
              title="Create New Transaction or Record"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">+ NEW</span>
              <ChevronDown className="w-3 h-3 text-sky-200" />
            </button>

            {newMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  Quick Create
                </div>
                <div className="py-1">
                  <Link
                    href="/receivables/payments"
                    className="flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>Customer Receipt</span>
                  </Link>
                  <Link
                    href="/payments"
                    className="flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <CreditCard className="w-4 h-4 text-sky-600" />
                    <span>Supplier Payment</span>
                  </Link>
                  <Link
                    href="/transport"
                    className="flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span>Transport Payment</span>
                  </Link>
                  <Link
                    href="/expenses"
                    className="flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Wallet className="w-4 h-4 text-purple-600" />
                    <span>Expense Voucher</span>
                  </Link>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <Link
                    href="/invoices"
                    className="flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    <span>Sales Invoice</span>
                  </Link>
                  <Link
                    href="/purchases"
                    className="flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ShoppingBag className="w-4 h-4 text-teal-600" />
                    <span>Purchase Order</span>
                  </Link>
                  <Link
                    href="/shipments"
                    className="flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Ship className="w-4 h-4 text-blue-600" />
                    <span>Shipment / Container</span>
                  </Link>
                  <Link
                    href="/accounting/journal"
                    className="flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span>Journal Entry</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* 2. Notifications Center */}
          <Link
            href="/notifications"
            className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Notifications & System Alerts"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
          </Link>

          {/* 3. Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-sky-600" />
            )}
          </button>

          {/* 4. Company Switcher Dropdown */}
          <div className="relative" ref={companyMenuRef}>
            <button
              type="button"
              onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
              className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:border-sky-500 transition-all text-xs font-bold shadow-2xs"
              title="Active Legal Entity"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: activeCompany ? activeCompany.color_accent || "#2563eb" : "#6366f1",
                }}
              />
              <span className="truncate max-w-[130px] lg:max-w-[170px]">
                {activeCompany ? activeCompany.company_name : "AQ COMPANIES (Group)"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {companyMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  Select Legal Entity Context
                </div>

                {/* All Companies Option */}
                <button
                  type="button"
                  onClick={() => handleSelectCompany(0)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                    activeCompanyId === 0
                      ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-bold"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <div>
                      <div>ALL COMPANIES</div>
                      <div className="text-[10px] text-slate-400">Consolidated Group Reporting</div>
                    </div>
                  </div>
                  {activeCompanyId === 0 && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                {/* Individual Companies */}
                {companies.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => handleSelectCompany(c.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                      activeCompanyId === c.id
                        ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-bold"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.color_accent || "#2563eb" }}
                      />
                      <div>
                        <div>{c.company_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.company_code}</div>
                      </div>
                    </div>
                    {activeCompanyId === c.id && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                  </button>
                ))}

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <Link
                  href="/settings/companies"
                  onClick={() => setCompanyMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-[11px]"
                >
                  <span className="flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Manage Company Entities</span>
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </Link>
              </div>
            )}
          </div>

          {/* 5. User Menu Dropdown (Avatar + Initials + Role) */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-2 p-1 sm:px-2 sm:py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              title="Account Menu"
              aria-label="Account Menu"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {user?.initials || "AQ"}
              </div>
              <div className="hidden lg:block text-left text-[11px] leading-tight pr-1">
                <div className="font-bold text-slate-900 dark:text-white truncate max-w-[110px]">
                  {user?.full_name || "Ahsanullah Qureshi"}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  {user?.role || "ADMIN"}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 hidden lg:block" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs">
                {/* Account Details Header */}
                <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {user?.full_name || "Ahsanullah Qureshi"}
                  </div>
                  <div className="text-[11px] text-slate-400">{user?.email || "admin@aqcompanies.com"}</div>
                  <div className="mt-1">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                      {user?.title || "SYSTEM ADMINISTRATOR"}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>My Profile</span>
                  </Link>
                  <Link
                    href="/settings/companies"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>Company Entities</span>
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <SettingsIcon className="w-4 h-4 text-slate-400" />
                    <span>System Settings</span>
                  </Link>
                </div>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                {/* macOS Lock Screen Action */}
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    lockSession();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <Lock className="w-4 h-4 text-amber-500" />
                  <span className="font-medium">Lock Screen (macOS)</span>
                </button>

                {/* Log Out */}
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
