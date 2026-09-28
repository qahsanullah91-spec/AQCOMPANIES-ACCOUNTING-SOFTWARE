"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  ListTree,
  BookOpen,
  FileText,
  Users,
  CreditCard,
  Building2,
  Truck,
  Landmark,
  Scale,
  TrendingUp,
  ArrowUpDown,
  FileCheck2,
  Lock,
  Layers,
  CalendarCheck,
  Wallet,
  ArrowRightLeft,
  ShieldCheck,
  BarChart3,
  Target,
  ShieldAlert,
  Briefcase,
  Bell,
  HardDrive,
  Activity,
} from "lucide-react";

export function AccountingNav() {
  const pathname = usePathname();

  const links = [
    { label: "Overview", href: "/accounting", icon: Calculator },
    { label: "Group Management", href: "/management/group", icon: Briefcase },
    { label: "Central Treasury", href: "/treasury", icon: Wallet },
    { label: "Intercompany", href: "/accounting/intercompany", icon: ArrowRightLeft },
    { label: "Consolidated P&L", href: "/accounting/consolidated/profit-loss", icon: TrendingUp },
    { label: "Consolidated BS", href: "/accounting/consolidated/balance-sheet", icon: Layers },
    { label: "Company Entities", href: "/settings/companies", icon: Building2 },
    { label: "Approvals & 4-Eyes", href: "/accounting/approvals", icon: ShieldCheck },
    { label: "Notifications", href: "/notifications", icon: Bell },
    { label: "System Health", href: "/settings/system-health", icon: Activity },
    { label: "Backups & Restore", href: "/settings/backups", icon: HardDrive },
    { label: "Go-Live Readiness", href: "/settings/go-live", icon: ShieldCheck },
    { label: "Stabilization Control", href: "/settings/stabilization", icon: Activity },
    { label: "Reports Center", href: "/accounting/reports", icon: BarChart3 },
    { label: "Daily Accounting", href: "/accounting/daily", icon: CalendarCheck },
    { label: "Sarafi & Hawala", href: "/accounting/sarafi", icon: ArrowRightLeft },
    { label: "Cashbook", href: "/accounting/cashbook", icon: Wallet },
    { label: "Bankbook", href: "/accounting/bankbook", icon: Landmark },
    { label: "Period Closing", href: "/accounting/periods", icon: Lock },
    { label: "Budgets & Variance", href: "/accounting/budgets", icon: Target },
    { label: "Cash Forecast", href: "/accounting/cash-forecast", icon: TrendingUp },
    { label: "Audit Center", href: "/accounting/audit", icon: ShieldAlert },
    { label: "Management", href: "/accounting/management", icon: Briefcase },
    { label: "Integrity Health", href: "/accounting/health", icon: ShieldCheck },
    { label: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: ListTree },
    { label: "General Ledger", href: "/accounting/general-ledger", icon: BookOpen },
    { label: "Journals", href: "/accounting/journals", icon: FileText },
    { label: "Receivables & Aging", href: "/accounting/receivables", icon: Users },
    { label: "Payment Allocation", href: "/accounting/allocation", icon: CreditCard },
    { label: "Supplier Payables", href: "/accounting/payables", icon: Building2 },
    { label: "Transport Account", href: "/accounting/transport", icon: Truck },
    { label: "Reconciliation", href: "/accounting/reconciliation", icon: Scale },
    { label: "Trial Balance", href: "/accounting/trial-balance", icon: Layers },
    { label: "Balance Sheet", href: "/accounting/balance-sheet", icon: Scale },
    { label: "Profit & Loss", href: "/accounting/profit-and-loss", icon: TrendingUp },
    { label: "Cash Flow", href: "/accounting/cash-flow", icon: ArrowUpDown },
    { label: "Opening Balances", href: "/accounting/opening-balances", icon: Scale },
    { label: "Statements", href: "/accounting/statements", icon: FileCheck2 },
  ];

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl px-2 py-1 shadow-2xs mb-6 overflow-x-auto">
      <div className="flex items-center space-x-1 min-w-max">
        {links.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
