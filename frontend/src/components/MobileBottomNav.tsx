"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  PlusCircle,
  Calculator,
  Grid,
  CreditCard,
  Building2,
  Wallet,
  X,
  ChevronRight,
} from "lucide-react";
import { MobileMoreDrawer } from "./MobileMoreDrawer";
import { ReceiveMoneyModal } from "./ReceiveMoneyModal";
import { MobileBottomSheet } from "./MobileBottomSheet";

interface MobileBottomNavProps {
  onOpenMore?: () => void;
  isMoreOpen?: boolean;
}

export function MobileBottomNav({
  onOpenMore,
  isMoreOpen = false,
}: MobileBottomNavProps = {}) {
  const pathname = usePathname();
  const [internalMoreOpen, setInternalMoreOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveTypeSheetOpen, setReceiveTypeSheetOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Keyboard safe area detection: hide bottom nav when virtual keyboard is up (Req 13)
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleResize = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      // If viewport is reduced by > 150px, keyboard is active
      if (window.innerHeight - vh > 150) {
        setIsKeyboardOpen(true);
      } else {
        setIsKeyboardOpen(false);
      }
    };

    window.visualViewport.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  const moreOpen = isMoreOpen || internalMoreOpen;
  const handleOpenMore = () => {
    if (onOpenMore) {
      onOpenMore();
    } else {
      setInternalMoreOpen(true);
    }
  };

  // Tab Active Checking
  const isHomeActive = pathname === "/" || pathname === "/dashboard";
  const isBankActive = pathname.startsWith("/banking");
  const isAccountingActive =
    pathname.startsWith("/accounting") &&
    !pathname.startsWith("/accounting/audit-log") &&
    !pathname.startsWith("/accounting/daily") &&
    !pathname.startsWith("/accounting/transport");

  const isMoreActive =
    moreOpen ||
    (!isHomeActive && !isBankActive && !isAccountingActive);

  // If virtual keyboard is open, hide bottom nav to avoid overlapping input forms (Req 13)
  if (isKeyboardOpen) {
    return null;
  }

  return (
    <>
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)] lg:hidden no-print select-none shadow-lg transition-all duration-150"
      >
        <div className="grid grid-cols-5 h-14 max-w-lg mx-auto items-center px-1">
          {/* 1. Dashboard */}
          <Link
            href="/"
            className={`flex flex-col items-center justify-center h-full active:scale-95 transition-transform relative min-h-[44px] ${
              isHomeActive
                ? "text-sky-600 dark:text-sky-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 ${isHomeActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Dashboard</span>
            {isHomeActive && (
              <span className="absolute top-1 w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
            )}
          </Link>

          {/* 2. Banking */}
          <Link
            href="/banking"
            className={`flex flex-col items-center justify-center h-full active:scale-95 transition-transform relative min-h-[44px] ${
              isBankActive
                ? "text-sky-600 dark:text-sky-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <Landmark className={`w-5 h-5 ${isBankActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Banking</span>
            {isBankActive && (
              <span className="absolute top-1 w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
            )}
          </Link>

          {/* 3. RECEIVE (Center Action Button - Prominent but not oversized, Req 4, 5) */}
          <div className="flex items-center justify-center h-full">
            <button
              type="button"
              onClick={() => setReceiveTypeSheetOpen(true)}
              className="flex flex-col items-center justify-center -mt-3.5 w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-600/30 active:scale-90 transition-transform border-2 border-white dark:border-[#0B0F19] cursor-pointer"
              title="Receive Money"
              aria-label="Receive Money"
            >
              <PlusCircle className="w-6 h-6 stroke-[2.2]" />
              <span className="text-[9px] font-black tracking-tight -mt-0.5">Receive</span>
            </button>
          </div>

          {/* 4. Accounting */}
          <Link
            href="/accounting"
            className={`flex flex-col items-center justify-center h-full active:scale-95 transition-transform relative min-h-[44px] ${
              isAccountingActive
                ? "text-sky-600 dark:text-sky-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <Calculator className={`w-5 h-5 ${isAccountingActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">Accounting</span>
            {isAccountingActive && (
              <span className="absolute top-1 w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
            )}
          </Link>

          {/* 5. More */}
          <button
            type="button"
            onClick={handleOpenMore}
            className={`flex flex-col items-center justify-center h-full active:scale-95 transition-transform relative min-h-[44px] cursor-pointer ${
              isMoreActive
                ? "text-sky-600 dark:text-sky-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
            }`}
          >
            <Grid className={`w-5 h-5 ${isMoreActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">More</span>
            {isMoreActive && (
              <span className="absolute top-1 w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
            )}
          </button>
        </div>
      </nav>

      {/* Receive Options Sheet (Req 5: Customer Receipt, Cash Receipt, Bank Receipt) */}
      <MobileBottomSheet
        isOpen={receiveTypeSheetOpen}
        onClose={() => setReceiveTypeSheetOpen(false)}
        title="Receive Money"
        subtitle="Select receipt category to record into ledger"
        maxHeight="max-h-[65dvh]"
      >
        <div className="space-y-2 pb-6 pt-1">
          {/* Customer Receipt */}
          <button
            type="button"
            onClick={() => {
              setReceiveTypeSheetOpen(false);
              setReceiveModalOpen(true);
            }}
            className="w-full text-left flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 active:scale-[0.98] transition-all min-h-[56px] cursor-pointer"
          >
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                  Customer Receipt
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Allocate against open commercial export invoices
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
          </button>

          {/* Cash Receipt */}
          <button
            type="button"
            onClick={() => {
              setReceiveTypeSheetOpen(false);
              setReceiveModalOpen(true);
            }}
            className="w-full text-left flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 active:scale-[0.98] transition-all min-h-[56px] cursor-pointer"
          >
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                  Cash Receipt
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Physical cash, vault deposit, or Sarafi hawala inflow
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          </button>

          {/* Bank Receipt */}
          <button
            type="button"
            onClick={() => {
              setReceiveTypeSheetOpen(false);
              setReceiveModalOpen(true);
            }}
            className="w-full text-left flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 active:scale-[0.98] transition-all min-h-[56px] cursor-pointer"
          >
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                  Bank Wire Receipt
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  SWIFT remittance, bank wire, or direct MT103 credit
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          </button>
        </div>
      </MobileBottomSheet>

      {/* Direct Customer Receipt Flow (Req 6-10) */}
      <ReceiveMoneyModal
        isOpen={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
      />

      {/* Slide-out More Menu Drawer (only when used standalone without AppLayoutShell) */}
      {!onOpenMore && (
        <MobileMoreDrawer
          isOpen={internalMoreOpen}
          onClose={() => setInternalMoreOpen(false)}
        />
      )}
    </>
  );
}
