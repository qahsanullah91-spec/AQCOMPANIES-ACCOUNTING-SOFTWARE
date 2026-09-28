"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Truck,
  Ship,
  Boxes,
  ShoppingBag,
  Receipt,
  Users,
  Wallet,
  PieChart,
  ShieldCheck,
  HardDriveDownload,
  Settings,
  X,
  Moon,
  Sun,
  Layers,
  ChevronRight,
  Calculator,
  Landmark,
  Scale,
  TrendingUp,
  ArrowRightLeft,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { API_BASE } from "@/lib/api";

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQuickAction?: () => void;
}

interface Company {
  id: number;
  company_code: string;
  company_name: string;
  status: string;
}

export function MobileMoreDrawer({
  isOpen,
  onClose,
  onOpenQuickAction,
}: MobileMoreDrawerProps) {
  const pathname = usePathname();
  const { isDark, toggleTheme } = useTheme();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<number>(0);

  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname]);

  // Fetch companies
  useEffect(() => {
    fetch(`${API_BASE}/companies`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.companies) {
          setCompanies(data.companies);
        }
      })
      .catch((err) => console.error(err));

    const saved = localStorage.getItem("aq_active_company_id");
    if (saved !== null) {
      setActiveCompanyId(parseInt(saved, 10));
    }
  }, []);

  const handleSelectCompany = (id: number) => {
    setActiveCompanyId(id);
    localStorage.setItem("aq_active_company_id", id.toString());
    window.location.reload();
  };

  if (!isOpen) return null;

  // Exact sections as required in Section 6
  const moreSections = [
    {
      group: "PAYMENTS",
      items: [
        { name: "Supplier Payment", href: "/payables", icon: Building2 },
        { name: "Transport Payment", href: "/transport/account", icon: Truck, badge: "AQ Credit" },
        { name: "Expense", href: "/expenses", icon: Wallet },
        { name: "Transfer", href: "/banking/transactions", icon: ArrowRightLeft },
      ],
    },
    {
      group: "OPERATIONS",
      items: [
        { name: "Shipments", href: "/shipments", icon: Ship, badge: "Tracking" },
        { name: "Purchases", href: "/purchases", icon: ShoppingBag },
        { name: "New Stock", href: "/new-stock", icon: Boxes },
        { name: "Invoices", href: "/invoices", icon: Receipt },
      ],
    },
    {
      group: "MASTER DATA",
      items: [
        { name: "Customers", href: "/customers", icon: Users },
        { name: "Suppliers", href: "/suppliers", icon: Building2 },
        { name: "Transport Companies", href: "/transport", icon: Truck },
      ],
    },
    {
      group: "REPORTS",
      items: [
        { name: "P&L", href: "/profit-and-loss", icon: TrendingUp },
        { name: "Balance Sheet", href: "/accounting/balance-sheet", icon: Scale },
        { name: "Trial Balance", href: "/accounting/trial-balance", icon: Layers },
        { name: "Cash Flow", href: "/accounting/cash-flow", icon: Landmark },
        { name: "Statements", href: "/accounting/statements", icon: FileText },
      ],
    },
    {
      group: "SYSTEM",
      items: [
        { name: "Audit", href: "/accounting/audit-log", icon: ShieldCheck },
        { name: "Backup", href: "/backup", icon: HardDriveDownload },
        { name: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="relative w-full max-h-[88vh] max-h-[88dvh] bg-white dark:bg-[#0B0F19] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-250 pb-[env(safe-area-inset-bottom)]">
        {/* Grab Handle */}
        <div className="pt-3 pb-1 flex justify-center cursor-pointer" onClick={onClose}>
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Drawer Header */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-black text-white text-xs shadow-xs">
              AQ
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                AQ Navigation Hub
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Financial, Operational & System Modules
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Company Quick Selector Bar */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            <span>Company:</span>
          </span>
          <select
            value={activeCompanyId}
            onChange={(e) => handleSelectCompany(parseInt(e.target.value, 10))}
            className="text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-2.5 text-slate-800 dark:text-slate-200 cursor-pointer min-h-[36px]"
          >
            <option value={0}>All Companies (Consolidated)</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name} ({c.company_code})
              </option>
            ))}
          </select>
        </div>

        {/* Scrollable Links Content */}
        <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1 overscroll-contain">
          {moreSections.map((sec) => (
            <div key={sec.group} className="space-y-1.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                {sec.group}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center justify-between p-3 rounded-xl transition-all min-h-[48px] ${
                        isActive
                          ? "bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-bold border border-sky-200 dark:border-sky-800"
                          : "bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800/60 font-semibold"
                      }`}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? "bg-sky-600 text-white"
                              : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 shadow-2xs"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs truncate">{item.name}</span>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black rounded uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer User & Actions */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-xs">
              AQ
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white leading-tight">
                Ahsanullah Qureshi
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Administrator
              </div>
            </div>
          </div>

          <Link
            href="/settings"
            onClick={onClose}
            className="flex items-center space-x-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 p-2 min-h-[44px]"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
