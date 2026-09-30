"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Calculator,
  BookOpen,
  FileSpreadsheet,
  FileText,
  Scale,
  TrendingUp,
  Layers,
  Activity,
  Landmark,
  CreditCard,
  ArrowLeftRight,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Receipt,
  Users,
  Building2,
  Clock,
  PieChart,
  Truck,
  Ship,
  Boxes,
  ShoppingBag,
  FolderOpen,
  ShieldCheck,
  HardDriveDownload,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Lock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: "overview",
    title: "OVERVIEW",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Daily Accounting", href: "/accounting/daily", icon: CalendarCheck },
    ],
  },
  {
    id: "accounting",
    title: "ACCOUNTING",
    items: [
      { name: "Accounting Dashboard", href: "/accounting", icon: Calculator },
      { name: "General Ledger", href: "/accounting/general-ledger", icon: BookOpen },
      { name: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: FileSpreadsheet },
      { name: "Journal Entries", href: "/accounting/journal", icon: FileText },
      { name: "Trial Balance", href: "/accounting/trial-balance", icon: Scale },
      { name: "Profit & Loss", href: "/accounting/profit-loss", icon: TrendingUp },
      { name: "Balance Sheet", href: "/accounting/balance-sheet", icon: Layers },
      { name: "Cash Flow", href: "/accounting/cash-flow", icon: Activity },
    ],
  },
  {
    id: "banking",
    title: "BANKING",
    items: [
      { name: "Banking Hub", href: "/banking", icon: Landmark },
      { name: "Bank Accounts", href: "/banking/accounts", icon: CreditCard },
      { name: "Bank Ledger", href: "/banking/transactions", icon: ArrowLeftRight },
      { name: "Statement Import", href: "/banking/import", icon: UploadCloud },
      { name: "Reconciliation", href: "/banking/reconciliation", icon: CheckCircle },
      { name: "Unmatched Transactions", href: "/banking/unmatched", icon: AlertCircle },
      { name: "SWIFT / MT103", href: "/banking/mt103", icon: Receipt },
    ],
  },
  {
    id: "receivables",
    title: "RECEIVABLES",
    items: [
      { name: "Customer Receivables", href: "/receivables", icon: Receipt },
      { name: "Customer Receipts", href: "/receivables/payments", icon: CreditCard },
      { name: "Payment Allocation", href: "/accounting/allocation", icon: ArrowLeftRight },
      { name: "Aging", href: "/accounting/reports/receivable-aging", icon: Clock },
      { name: "Customer Statements", href: "/accounting/statements", icon: FileText },
    ],
  },
  {
    id: "payables",
    title: "PAYABLES",
    items: [
      { name: "Supplier Payables", href: "/payables", icon: Building2 },
      { name: "Supplier Payments", href: "/payments", icon: CreditCard },
      { name: "Supplier Statements", href: "/accounting/reports/payable-aging", icon: Clock },
    ],
  },
  {
    id: "transport",
    title: "TRANSPORT",
    items: [
      { name: "Transport Account", href: "/transport/account", icon: Truck },
      { name: "Transport Payments", href: "/transport", icon: CreditCard },
      { name: "Transport Statement", href: "/accounting/transport", icon: FileText },
    ],
  },
  {
    id: "operations",
    title: "OPERATIONS",
    items: [
      { name: "Shipments", href: "/shipments", icon: Ship },
      { name: "New Stock", href: "/new-stock", icon: Boxes },
      { name: "Purchases", href: "/purchases", icon: ShoppingBag },
      { name: "Sales / Invoices", href: "/invoices", icon: Receipt },
    ],
  },
  {
    id: "master_data",
    title: "MASTER DATA",
    items: [
      { name: "Customers", href: "/customers", icon: Users },
      { name: "Suppliers", href: "/suppliers", icon: Building2 },
      { name: "Transport Companies", href: "/transport", icon: Truck },
      { name: "Documents", href: "/documents", icon: FolderOpen },
    ],
  },
  {
    id: "system",
    title: "SYSTEM",
    items: [
      { name: "Audit Trail", href: "/accounting/audit-log", icon: ShieldCheck },
      { name: "Backup", href: "/backup", icon: HardDriveDownload },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { lockSession } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    accounting: true,
    banking: true,
    receivables: true,
    payables: true,
    transport: true,
    operations: true,
    master_data: true,
    system: true,
  });

  // Listen to mobile toggle from TopNav
  useEffect(() => {
    const handleToggle = () => setMobileOpen((prev) => !prev);
    window.addEventListener("aq_toggle_mobile_sidebar", handleToggle);
    return () => window.removeEventListener("aq_toggle_mobile_sidebar", handleToggle);
  }, []);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const isItemActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname === "/dashboard";
    }
    if (href === "/receivables") {
      return pathname === "/receivables";
    }
    if (href === "/transport") {
      return pathname === "/transport";
    }
    if (href === "/accounting") {
      return pathname === "/accounting";
    }
    if (href === "/banking") {
      return pathname === "/banking";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`h-screen sticky top-0 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex flex-col border-r border-slate-200 dark:border-slate-800 shrink-0 select-none z-50 transition-all duration-200 no-print ${
          collapsed ? "w-[72px]" : "w-[270px]"
        } ${
          mobileOpen
            ? "fixed inset-y-0 left-0 shadow-2xl flex"
            : "hidden lg:flex"
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 px-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between shrink-0">
          <Link href="/" className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-black text-white shadow-md shadow-sky-600/20 tracking-wider shrink-0">
              AQ
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-black tracking-wider text-slate-900 dark:text-white truncate">
                  AQ COMPANIES
                </div>
                <div className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold tracking-tight truncate">
                  Trading • Logistics • Accounting
                </div>
              </div>
            )}
          </Link>

          {/* Desktop Collapse / Mobile Close Button */}
          <div className="flex items-center">
            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 lg:hidden"
              aria-label="Close Sidebar"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Desktop collapse toggle */}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title={collapsed ? "Expand Sidebar (270px)" : "Collapse Sidebar"}
              aria-label="Toggle Sidebar"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Grouped Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3 scrollbar-thin">
          {navGroups.map((group) => {
            const isOpen = openGroups[group.id] !== false;

            return (
              <div key={group.id} className="space-y-0.5">
                {/* Group Title Accordion Header */}
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-md"
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-150 ${
                        isOpen ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                  </button>
                ) : (
                  <div className="h-2" />
                )}

                {/* Items */}
                {(collapsed || isOpen) && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isItemActive(item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={collapsed ? item.name : undefined}
                          className={`flex items-center text-xs rounded-lg transition-colors group relative ${
                            collapsed
                              ? "justify-center p-2.5"
                              : "px-2.5 py-1.5 font-medium"
                          } ${
                            active
                              ? "bg-sky-600 text-white font-bold shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              active
                                ? "text-white"
                                : "text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                            } ${!collapsed ? "mr-2.5" : ""}`}
                          />
                          {!collapsed && (
                            <span className="truncate">{item.name}</span>
                          )}

                          {/* Hover Tooltip in Collapsed Mode */}
                          {collapsed && (
                            <span className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                              {item.name}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* System Status Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between shrink-0">
          {!collapsed ? (
            <>
              <div className="flex items-center space-x-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                  AQ Local Server
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={lockSession}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-500 transition-colors"
                  title="Lock Screen (macOS)"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-slate-400 text-[10px]">v1.0.0</span>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-center">
              <button
                type="button"
                onClick={lockSession}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-500 transition-colors"
                title="Lock Screen (macOS)"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
