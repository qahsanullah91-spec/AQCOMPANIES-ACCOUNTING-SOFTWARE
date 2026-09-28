"use client";

import React from "react";
import { Filter, RotateCcw, Check } from "lucide-react";
import { MobileBottomSheet } from "./MobileBottomSheet";

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  title?: string;
  children: React.ReactNode;
}

export function MobileFilterSheet({
  isOpen,
  onClose,
  onApply,
  onClear,
  title = "Filter Records",
  children,
}: MobileFilterSheetProps) {
  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle="Refine dates, accounts, customers, or currencies"
      maxHeight="max-h-[85dvh]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 min-h-[44px] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Filters</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onApply();
              onClose();
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs min-h-[44px] cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Filters</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4 py-1">{children}</div>
    </MobileBottomSheet>
  );
}
