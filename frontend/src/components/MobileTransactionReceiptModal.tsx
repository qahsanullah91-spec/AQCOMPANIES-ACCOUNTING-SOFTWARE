"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  FileText,
  Share2,
  BookOpen,
  PlusCircle,
  X,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Building,
  DollarSign,
  CreditCard,
} from "lucide-react";
import { QuickCopy } from "@/components/QuickCopy";
import { formatUSD, formatCurrency } from "@/lib/api";
import { MobilePdfViewerModal } from "@/components/MobilePdfViewerModal";

export interface TransactionReceiptData {
  transactionCode: string;
  type: string; // e.g. "Customer Receipt", "Supplier Payment", "Journal Entry", "Expense", "Bank Transfer"
  amount: number;
  currency?: string;
  partyName?: string;
  accountName?: string;
  date?: string;
  notes?: string;
  pdfUrl?: string;
  ledgerUrl?: string;
}

interface MobileTransactionReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewTransaction?: () => void;
  data: TransactionReceiptData | null;
}

export function MobileTransactionReceiptModal({
  isOpen,
  onClose,
  onNewTransaction,
  data,
}: MobileTransactionReceiptModalProps) {
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  if (!isOpen || !data) return null;

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `AQ Companies Receipt - ${data.transactionCode}`,
          text: `${data.type} posted: ${formatCurrency(data.amount, data.currency || "USD")} for ${
            data.partyName || "AQ Companies"
          } (Ref: ${data.transactionCode})`,
          url: window.location.href,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") console.warn("Share failed:", err);
      }
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
        <div className="w-full sm:max-w-md bg-white dark:bg-[#111827] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] max-h-[92dvh] animate-slideUp">
          {/* Header */}
          <div className="px-5 pt-6 pb-4 text-center border-b border-slate-100 dark:border-slate-800 relative bg-emerald-50/50 dark:bg-emerald-950/20">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-emerald-600 text-white shadow-xs">
              ✓ POSTED
            </span>

            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-2">
              {data.type} Confirmed
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Financial transaction permanently posted to General Ledger
            </p>
          </div>

          {/* Receipt Details Card */}
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Amount Banner */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Posted Amount
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatCurrency(data.amount, data.currency || "USD")}
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <span className="text-xs text-slate-500 font-medium">Voucher Ref:</span>
                <QuickCopy text={data.transactionCode} />
              </div>
            </div>

            {/* Metadata Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {data.partyName && (
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    Party / Beneficiary
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-right">
                    {data.partyName}
                  </span>
                </div>
              )}

              {data.accountName && (
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    Bank / Payment Account
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-right">
                    {data.accountName}
                  </span>
                </div>
              )}

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Posting Date
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {data.date || new Date().toISOString().split("T")[0]}
                </span>
              </div>

              {data.notes && (
                <div className="py-2.5 space-y-1">
                  <span className="text-slate-500 font-medium text-[11px]">Notes / Memo</span>
                  <p className="text-slate-700 dark:text-slate-300 italic text-[11px] bg-slate-50 dark:bg-slate-900 p-2 rounded-lg">
                    "{data.notes}"
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions (Req 42) */}
            <div className="pt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {data.pdfUrl ? (
                  <button
                    type="button"
                    onClick={() => setPdfModalOpen(true)}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                  >
                    <FileText className="w-4 h-4 text-rose-500" />
                    Voucher PDF
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleShare}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                  >
                    <Share2 className="w-4 h-4 text-sky-500" />
                    Share Voucher
                  </button>
                )}

                <Link
                  href={data.ledgerUrl || "/accounting/general-ledger"}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-all text-center"
                >
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  View in Ledger
                </Link>
              </div>

              {onNewTransaction && (
                <button
                  type="button"
                  onClick={onNewTransaction}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  New {data.type}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Modal if requested */}
      {data.pdfUrl && (
        <MobilePdfViewerModal
          isOpen={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          pdfUrl={data.pdfUrl}
          title={`${data.type} Voucher`}
          referenceCode={data.transactionCode}
        />
      )}
    </>
  );
}
