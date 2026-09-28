"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  Building2,
  Truck,
  Ship,
  Boxes,
  ShoppingBag,
  Receipt,
  Users,
  CreditCard,
  PieChart,
  ShieldCheck,
  HardDriveDownload,
  Settings,
  Scale,
  TrendingUp,
  Layers,
  ArrowRightLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { MobileBottomSheet } from "./MobileBottomSheet";

interface MobileMoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "Accounting & Finance" | "Operations & Logistics" | "Master Data" | "System";
  badge?: string;
}

const menuItems: MenuItem[] = [
  // Accounting & Finance
  {
    title: "Daily Accounting",
    href: "/accounting/daily",
    icon: CalendarCheck,
    category: "Accounting & Finance",
  },
  {
    title: "Supplier Payables",
    href: "/payables",
    icon: Building2,
    category: "Accounting & Finance",
  },
  {
    title: "Transport Account",
    href: "/transport/account",
    icon: Truck,
    category: "Accounting & Finance",
    badge: "Credit Standing",
  },
  {
    title: "Payment Allocation",
    href: "/accounting/allocation",
    icon: ArrowRightLeft,
    category: "Accounting & Finance",
  },
  {
    title: "General Ledger",
    href: "/accounting/general-ledger",
    icon: Layers,
    category: "Accounting & Finance",
  },
  {
    title: "Trial Balance",
    href: "/accounting/trial-balance",
    icon: Scale,
    category: "Accounting & Finance",
  },
  {
    title: "Profit & Loss",
    href: "/accounting/profit-loss",
    icon: TrendingUp,
    category: "Accounting & Finance",
  },
  {
    title: "Balance Sheet",
    href: "/accounting/balance-sheet",
    icon: Scale,
    category: "Accounting & Finance",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: PieChart,
    category: "Accounting & Finance",
  },

  // Operations & Logistics
  {
    title: "Shipments",
    href: "/shipments",
    icon: Ship,
    category: "Operations & Logistics",
  },
  {
    title: "New Stock",
    href: "/new-stock",
    icon: Boxes,
    category: "Operations & Logistics",
  },
  {
    title: "Purchases",
    href: "/purchases",
    icon: ShoppingBag,
    category: "Operations & Logistics",
  },
  {
    title: "Invoices",
    href: "/invoices",
    icon: Receipt,
    category: "Operations & Logistics",
  },

  // Master Data
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    category: "Master Data",
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    icon: Building2,
    category: "Master Data",
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: CreditCard,
    category: "Master Data",
  },

  // System
  {
    title: "Audit Trail",
    href: "/accounting/audit-log",
    icon: ShieldCheck,
    category: "System",
  },
  {
    title: "Backup",
    href: "/backup",
    icon: HardDriveDownload,
    category: "System",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    category: "System",
  },
];

export function MobileMoreMenu({ isOpen, onClose }: MobileMoreMenuProps) {
  const pathname = usePathname();

  const categories: MenuItem["category"][] = [
    "Accounting & Finance",
    "Operations & Logistics",
    "Master Data",
    "System",
  ];

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="AQ Companies Navigation"
      subtitle="Financial, Operational & System Modules"
      maxHeight="max-h-[88dvh]"
    >
      <div className="space-y-6 pb-6">
        {categories.map((cat) => {
          const items = menuItems.filter((m) => m.category === cat);
          return (
            <div key={cat} className="space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                {cat}
              </h4>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/"
                      ? pathname === "/" || pathname === "/dashboard"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center justify-between px-4 py-3 min-h-[46px] transition-colors ${
                        isActive
                          ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-bold"
                          : "hover:bg-slate-100/70 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? "bg-sky-600 text-white"
                              : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold truncate">
                          {item.title}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {item.badge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </MobileBottomSheet>
  );
}
