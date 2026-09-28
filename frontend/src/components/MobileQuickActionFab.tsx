"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Receipt,
  Building2,
  Truck,
  Wallet,
  ArrowRightLeft,
  FileText,
  ChevronRight,
} from "lucide-react";
import { MobileBottomSheet } from "./MobileBottomSheet";
import { ReceiveMoneyModal } from "./ReceiveMoneyModal";

interface QuickAction {
  title: string;
  subtitle: string;
  href?: string;
  isModal?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

export function MobileQuickActionFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);

  const quickActions: QuickAction[] = [
    {
      title: "Receive Money",
      subtitle: "Customer payment receipt & invoice allocation",
      isModal: true,
      icon: Receipt,
      iconBg: "bg-emerald-100 dark:bg-emerald-950/60",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Pay Supplier",
      subtitle: "Procurement disbursement or Afghan advance",
      href: "/payables",
      icon: Building2,
      iconBg: "bg-sky-100 dark:bg-sky-950/60",
      iconColor: "text-sky-600 dark:text-sky-400",
    },
    {
      title: "Transport Payment",
      subtitle: "Carrier freight wire (Sky Ariana credit)",
      href: "/transport/account",
      icon: Truck,
      iconBg: "bg-amber-100 dark:bg-amber-950/60",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Expense Voucher",
      subtitle: "Operating expense, customs or port dues",
      href: "/expenses",
      icon: Wallet,
      iconBg: "bg-purple-100 dark:bg-purple-950/60",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Bank Transfer",
      subtitle: "Internal vault transfer or bank wire",
      href: "/banking/transactions",
      icon: ArrowRightLeft,
      iconBg: "bg-blue-100 dark:bg-blue-950/60",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Journal Entry",
      subtitle: "Manual double-entry general ledger voucher",
      href: "/accounting/daily",
      icon: FileText,
      iconBg: "bg-indigo-100 dark:bg-indigo-950/60",
      iconColor: "text-indigo-600 dark:text-indigo-400",
    },
  ];

  return (
    <>
      {/* Floating Action Button (iPhone viewports < lg) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-30 lg:hidden w-13 h-13 rounded-full bg-sky-600 hover:bg-sky-500 active:scale-90 text-white shadow-xl shadow-sky-600/35 border-2 border-white dark:border-slate-800 flex items-center justify-center transition-all duration-150 no-print"
        aria-label="Quick financial action (+)"
        title="Quick Financial Action"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Quick Action Bottom Sheet */}
      <MobileBottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Quick Financial Action"
        subtitle="Select a financial transaction to create"
        maxHeight="max-h-[85dvh]"
      >
        <div className="space-y-2 pb-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            if (action.isModal) {
              return (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setReceiveModalOpen(true);
                  }}
                  className="w-full text-left flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] border border-slate-200/70 dark:border-slate-700/60 transition-all min-h-[56px]"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${action.iconBg} ${action.iconColor} shadow-2xs`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {action.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {action.subtitle}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                </button>
              );
            }

            return (
              <Link
                key={action.title}
                href={action.href!}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] border border-slate-200/70 dark:border-slate-700/60 transition-all min-h-[56px]"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${action.iconBg} ${action.iconColor} shadow-2xs`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {action.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {action.subtitle}
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
              </Link>
            );
          })}
        </div>
      </MobileBottomSheet>

      {/* Direct Receive Money Fast Modal (Req 7, 8, 9) */}
      <ReceiveMoneyModal
        isOpen={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
      />
    </>
  );
}
