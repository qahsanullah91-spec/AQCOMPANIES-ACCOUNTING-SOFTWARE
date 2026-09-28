"use client";

import React, { useState, useEffect } from "react";
import { WifiOff, CheckCircle2 } from "lucide-react";
import { useNetwork } from "@/context/NetworkContext";

export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetwork();
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div
        role="alert"
        className="fixed top-0 inset-x-0 z-[60] pt-safe bg-rose-600 text-white px-4 py-2 text-center text-xs font-bold shadow-lg flex items-center justify-center gap-2 select-none"
      >
        <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
        <span>OFFLINE — FINANCIAL POSTING UNAVAILABLE</span>
        <span className="hidden sm:inline font-normal opacity-90 text-[11px]">
          (Network disconnected. Posting transactions is disabled to prevent duplicate entries)
        </span>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div
        role="status"
        className="fixed top-0 inset-x-0 z-[60] pt-safe bg-emerald-600 text-white px-4 py-2 text-center text-xs font-bold shadow-lg flex items-center justify-center gap-2 select-none animate-fadeIn"
      >
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>CONNECTION RESTORED — FINANCIAL POSTING AVAILABLE</span>
      </div>
    );
  }

  return null;
}
