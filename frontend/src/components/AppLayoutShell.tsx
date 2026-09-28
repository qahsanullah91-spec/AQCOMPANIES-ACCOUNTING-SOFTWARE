"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { MobileTopHeader } from "@/components/MobileTopHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileMoreDrawer } from "@/components/MobileMoreDrawer";
import { MobileQuickActionFab } from "@/components/MobileQuickActionFab";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SessionExpiryModal } from "@/components/SessionExpiryModal";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isAppHidden, setIsAppHidden] = useState(false);
  const [lastHiddenTime, setLastHiddenTime] = useState<number | null>(null);

  // App Switcher / Multitasking Privacy Shield & Auto-refresh (Req 56)
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setIsAppHidden(true);
        setLastHiddenTime(Date.now());
      } else {
        setIsAppHidden(false);
        // If app was backgrounded for more than 5 minutes, notify components to refresh stale data
        if (lastHiddenTime && Date.now() - lastHiddenTime > 300000) {
          window.dispatchEvent(new CustomEvent("aq_stale_data_refresh"));
        }
      }
    };

    const handlePageHide = () => {
      setIsAppHidden(true);
      setLastHiddenTime(Date.now());
    };

    const handlePageShow = () => {
      setIsAppHidden(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [lastHiddenTime]);

  return (
    <>
      <OfflineBanner />
      <SessionExpiryModal />

      {/* Multitasking / App Switcher Privacy Mask (Req 56) */}
      {isAppHidden && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-6 select-none animate-fadeIn"
        >
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4 shadow-2xl">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <div className="text-xl font-black text-white tracking-tight">AQ COMPANIES</div>
          <div className="text-xs uppercase tracking-widest text-sky-400 font-semibold mt-1">
            Financial Privacy Shield
          </div>
          <p className="text-[11px] text-slate-400 mt-2 max-w-xs">
            Financial statements and balances are protected in background / multitasking mode.
          </p>
        </div>
      )}

      {/* Desktop Sidebar (lg:flex, hidden on mobile) */}
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-screen-dvh">
        {/* Desktop Top Header (hidden on mobile, visible on lg:) */}
        <div className="hidden lg:block">
          <TopNav />
        </div>

        {/* Mobile Compact Top Header (visible on mobile, hidden on lg:) */}
        <MobileTopHeader onOpenMore={() => setMoreMenuOpen(true)} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-3 py-4 sm:p-4 md:p-6 pb-28 sm:pb-28 lg:pb-8 bg-slate-50/60 dark:bg-[#0B0F19] transition-colors">
          {children}
        </main>

        {/* Floating Quick Action Button (+ FAB) for Financial Creation */}
        <MobileQuickActionFab />

        {/* Mobile Bottom Navigation (visible on mobile, hidden on lg:) */}
        <MobileBottomNav
          onOpenMore={() => setMoreMenuOpen(true)}
          isMoreOpen={moreMenuOpen}
        />

        {/* Mobile More Navigation Drawer */}
        <MobileMoreDrawer
          isOpen={moreMenuOpen}
          onClose={() => setMoreMenuOpen(false)}
        />
      </div>
    </>
  );
}
