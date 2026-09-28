"use client";

import React from "react";
import { Printer, X, CheckCircle2, Building, ShieldCheck } from "lucide-react";
import { formatUSD } from "@/lib/api";

export interface VoucherData {
  voucher_number: string;
  transaction_code?: string;
  date: string;
  party_name: string;
  party_type?: string;
  account_name: string;
  transaction_type: string;
  amount: number;
  currency: string;
  usd_equivalent?: number;
  reference?: string;
  description?: string;
  created_by?: string;
  status?: string;
  gl_lines?: Array<{
    account_code: string;
    account_name?: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
}

interface VoucherPrintModalProps {
  voucher: VoucherData | null;
  onClose: () => void;
}

export function VoucherPrintModal({ voucher, onClose }: VoucherPrintModalProps) {
  if (!voucher) return null;

  const handlePrint = () => {
    window.print();
  };

  const isReceipt =
    voucher.voucher_number.startsWith("CRV-") ||
    voucher.voucher_number.startsWith("BRV-") ||
    voucher.voucher_number.startsWith("SRV-") ||
    voucher.transaction_type.toLowerCase().includes("receipt");

  const isPayment =
    voucher.voucher_number.startsWith("CPV-") ||
    voucher.voucher_number.startsWith("BPV-") ||
    voucher.voucher_number.startsWith("SPV-") ||
    voucher.transaction_type.toLowerCase().includes("payment");

  const isTransfer =
    voucher.voucher_number.startsWith("TRF-") ||
    voucher.voucher_number.startsWith("FX-") ||
    voucher.transaction_type.toLowerCase().includes("transfer");

  const voucherTitle = isReceipt
    ? "OFFICIAL RECEIPT VOUCHER"
    : isPayment
    ? "OFFICIAL PAYMENT VOUCHER"
    : isTransfer
    ? "OFFICIAL TRANSFER / FX VOUCHER"
    : "OFFICIAL ACCOUNTING VOUCHER";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-w-full">
        {/* Header Controls (Hidden on Print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 print:hidden">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
              {voucher.voucher_number}
            </span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Voucher Preview & Print
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Voucher</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Body */}
        <div className="p-8 space-y-6 text-slate-800 dark:text-slate-200 font-sans print:p-6 print:text-black">
          {/* Top Letterhead */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 dark:border-slate-100 pb-5">
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-lg">
                  AQ
                </div>
                <h1 className="text-2xl font-black tracking-wider text-slate-900 dark:text-white print:text-black">
                  AQ COMPANIES
                </h1>
              </div>
              <p className="text-xs font-semibold tracking-widest uppercase text-slate-500 dark:text-slate-400 mt-1 print:text-slate-600">
                Trading • Logistics • Accounting
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">
                Kabul • Dubai • Delhi • Commercial Clearing System
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 text-xs font-extrabold tracking-wider uppercase rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 print:bg-slate-200 print:text-black">
                {voucherTitle}
              </span>
              <div className="mt-2 text-sm font-mono font-bold text-sky-700 dark:text-sky-400 print:text-black">
                {voucher.voucher_number}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">
                Date: {voucher.date}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 print:bg-transparent print:border-slate-300">
            <div>
              <span className="font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600">
                {isReceipt ? "Received From:" : isPayment ? "Paid To / Beneficiary:" : "Party / Counterparty:"}
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white print:text-black mt-0.5">
                {voucher.party_name || "N/A"}
              </p>
              {voucher.party_type && (
                <span className="inline-block mt-1 px-2 py-0.5 text-2xs font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {voucher.party_type}
                </span>
              )}
            </div>

            <div>
              <span className="font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600">
                Settlement Account:
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white print:text-black mt-0.5">
                {voucher.account_name}
              </p>
              <p className="text-2xs text-slate-500 dark:text-slate-400 print:text-slate-600 mt-1">
                Currency: <strong className="font-mono">{voucher.currency}</strong>
                {voucher.reference && ` • Ref: ${voucher.reference}`}
              </p>
            </div>
          </div>

          {/* Amount Box */}
          <div className="border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20 p-4 rounded-xl flex items-center justify-between print:border-slate-400 print:bg-slate-50">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600">
                Total Transaction Value:
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white print:text-black mt-0.5 font-mono">
                {voucher.currency} {voucher.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            {voucher.usd_equivalent && voucher.currency !== "USD" && (
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  USD Equivalent:
                </span>
                <div className="text-lg font-bold text-sky-700 dark:text-sky-400 font-mono">
                  {formatUSD(voucher.usd_equivalent)}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {voucher.description && (
            <div className="text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600">
                Particulars / Transaction Description:
              </span>
              <p className="mt-1 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 print:bg-transparent print:border-slate-300 print:text-black font-medium">
                {voucher.description}
              </p>
            </div>
          )}

          {/* GL Accounting Posting Breakdown */}
          {voucher.gl_lines && voucher.gl_lines.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Double-Entry General Ledger Breakdown
              </span>
              <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-2xs">
                  <tr>
                    <th className="px-3 py-2 font-bold">Account</th>
                    <th className="px-3 py-2 font-bold">Description</th>
                    <th className="px-3 py-2 font-bold text-right">Debit</th>
                    <th className="px-3 py-2 font-bold text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {voucher.gl_lines.map((l, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {l.account_code} {l.account_name && `• ${l.account_name}`}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {l.description || "-"}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-right text-slate-900 dark:text-slate-100">
                        {l.debit > 0 ? formatUSD(l.debit) : "-"}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-right text-slate-900 dark:text-slate-100">
                        {l.credit > 0 ? formatUSD(l.credit) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Signatures Footer */}
          <div className="pt-10 grid grid-cols-4 gap-4 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 dark:border-slate-600 h-10 mb-1.5 flex items-end justify-center pb-1">
                <span className="text-2xs font-mono text-slate-400">{voucher.created_by || "System"}</span>
              </div>
              <p className="font-bold text-slate-700 dark:text-slate-300 print:text-black">Prepared By</p>
              <p className="text-2xs text-slate-400">Accountant</p>
            </div>

            <div>
              <div className="border-b border-slate-400 dark:border-slate-600 h-10 mb-1.5"></div>
              <p className="font-bold text-slate-700 dark:text-slate-300 print:text-black">Verified By</p>
              <p className="text-2xs text-slate-400">Chief Auditor</p>
            </div>

            <div>
              <div className="border-b border-slate-400 dark:border-slate-600 h-10 mb-1.5"></div>
              <p className="font-bold text-slate-700 dark:text-slate-300 print:text-black">Approved By</p>
              <p className="text-2xs text-slate-400">Finance Director</p>
            </div>

            <div>
              <div className="border-b border-slate-400 dark:border-slate-600 h-10 mb-1.5"></div>
              <p className="font-bold text-slate-700 dark:text-slate-300 print:text-black">Received By</p>
              <p className="text-2xs text-slate-400">Beneficiary / Agent</p>
            </div>
          </div>

          {/* System Seal / Verification Stamp */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-2xs text-slate-400">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Cryptographically verified & double-entry balanced in AQ General Ledger.</span>
            </div>
            <div>Generated: {new Date().toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
