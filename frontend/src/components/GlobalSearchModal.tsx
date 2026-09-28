"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  X,
  Ship,
  Receipt,
  Users,
  Building2,
  Truck,
  Boxes,
  CreditCard,
  Container,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileText,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setResults(null);
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when search is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchApi(`/search?q=${encodeURIComponent(query)}`);
        setResults(data);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:items-start md:justify-center md:pt-16 bg-slate-950/70 backdrop-blur-md p-0 md:p-4 animate-in fade-in duration-150">
      {/* Search Dialog Container */}
      <div className="bg-white dark:bg-slate-900 border-0 md:border border-slate-200 dark:border-slate-800 rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-h-[85dvh] md:max-w-2xl overflow-hidden flex flex-col pt-safe pb-safe">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 md:py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0 gap-2 bg-slate-50/70 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-2 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Search className="w-5 h-5 text-slate-400 shrink-0 hidden md:block" />

          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Invoices, Customers, Suppliers, BL, Containers, Bank Ref, MT103..."
            className="flex-1 bg-transparent border-0 outline-hidden text-base md:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 h-10"
          />

          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="hidden md:inline-flex px-2 py-1 text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
          >
            ESC
          </button>

          <button
            type="button"
            onClick={onClose}
            className="md:hidden text-xs font-bold text-sky-600 dark:text-sky-400 px-2 py-1"
          >
            Cancel
          </button>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
          {loading && (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <span>Searching AQ database...</span>
            </div>
          )}

          {!loading && results && results.total_count === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">
              No matching records found for "{query}"
            </div>
          )}

          {!loading && !results && !query && (
            <div className="py-8 text-center space-y-3">
              <div className="text-xs text-slate-400 max-w-xs mx-auto">
                Quick search across all invoices, customers, suppliers, containers, BLs, bank wires, and journal vouchers.
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                {["Invoices", "Customers", "Suppliers", "Containers", "BL Numbers", "Bank Wires", "MT103"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setQuery(tag)}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1. Invoices */}
          {results && results.invoices?.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                <Receipt className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Invoices ({results.invoices.length})
              </div>
              <div className="space-y-1.5">
                {results.invoices.map((inv: any) => (
                  <Link
                    key={inv.id}
                    href={`/invoices?search=${encodeURIComponent(inv.invoice_number)}`}
                    onClick={onClose}
                    className="flex flex-col p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs transition-colors min-h-[44px] justify-center"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                        {inv.invoice_number}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                        {inv.customer_name || "Customer"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatUSD(inv.total_amount || 0)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        inv.payment_status === "PAID"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                      }`}>
                        {inv.payment_status || "OPEN"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 2. Customers */}
          {results && results.customers?.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                <Users className="w-3.5 h-3.5 mr-1 text-sky-500" /> Customers ({results.customers.length})
              </div>
              <div className="space-y-1.5">
                {results.customers.map((c: any) => (
                  <Link
                    key={c.id}
                    href={`/customers/${c.id}`}
                    onClick={onClose}
                    className="flex flex-col p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs transition-colors min-h-[44px] justify-center"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {c.customer_name || c.name}
                      </span>
                      <span className="text-[11px] text-slate-500">{c.country || "India"}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="text-slate-500">Balance Due:</span>
                      <span className="font-mono font-black text-rose-600">
                        {formatUSD(c.balance_due || 0)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 3. Containers & Shipments */}
          {results && ((results.containers?.length > 0) || (results.shipments?.length > 0)) && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                <Container className="w-3.5 h-3.5 mr-1 text-indigo-500" /> Containers & Shipments ({((results.containers?.length || 0) + (results.shipments?.length || 0))})
              </div>
              <div className="space-y-1.5">
                {(results.containers || []).map((c: any, i: number) => (
                  <Link
                    key={`c-${i}`}
                    href={`/shipments`}
                    onClick={onClose}
                    className="flex flex-col p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs transition-colors min-h-[44px] justify-center"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {c.container_number || c.shipment_code}
                      </span>
                      <span className="text-slate-400 text-[11px]">BL: {c.bl_number || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                      <span>Inv: {c.invoice_number || "N/A"}</span>
                      <span>Truck: {c.truck_number || "N/A"}</span>
                    </div>
                  </Link>
                ))}
                {(results.shipments || []).map((s: any) => (
                  <Link
                    key={`s-${s.id}`}
                    href={s.url || "/shipments"}
                    onClick={onClose}
                    className="flex flex-col p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs transition-colors min-h-[44px] justify-center"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-600 dark:text-sky-400">{s.shipment_code}</span>
                      <span className="text-slate-600 dark:text-slate-300">{s.product}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                      <span>Inv: {s.invoice_number}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                        {s.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 4. Bank Transactions */}
          {results && ((results.bank_transactions?.length > 0) || (results.payments?.length > 0)) && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                <CreditCard className="w-3.5 h-3.5 mr-1 text-amber-500" /> Bank Transactions ({((results.bank_transactions?.length || 0) + (results.payments?.length || 0))})
              </div>
              <div className="space-y-1.5">
                {(results.bank_transactions || []).map((tx: any) => (
                  <Link
                    key={`tx-${tx.id}`}
                    href="/banking/transactions"
                    onClick={onClose}
                    className="flex flex-col p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs transition-colors min-h-[44px] justify-center"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {tx.transaction_code}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                        {tx.party_name || "Bank Wire"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] font-mono">
                      {tx.money_in > 0 ? (
                        <span className="text-emerald-600 font-bold">+{formatUSD(tx.money_in)}</span>
                      ) : (
                        <span className="text-rose-600 font-bold">-{formatUSD(tx.money_out)}</span>
                      )}
                      <span className="text-slate-400">Bank Entry</span>
                    </div>
                  </Link>
                ))}
                {(results.payments || []).map((p: any) => (
                  <Link
                    key={`p-${p.id}`}
                    href={p.url || "/banking/transactions"}
                    onClick={onClose}
                    className="flex flex-col p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs transition-colors min-h-[44px] justify-center"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{p.code}</span>
                      <span className="text-slate-500">{p.party}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="font-semibold text-emerald-600 font-mono">${(p.amount_usd || 0).toLocaleString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 5. Journals */}
          {results && results.journals?.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                <BookOpen className="w-3.5 h-3.5 mr-1 text-purple-500" /> Journals ({results.journals.length})
              </div>
              <div className="space-y-1.5">
                {results.journals.map((j: any) => (
                  <Link
                    key={j.id}
                    href="/accounting/general-ledger"
                    onClick={onClose}
                    className="flex flex-col p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs transition-colors min-h-[44px] justify-center"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                        {j.entry_number}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {j.reference || "Journal"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                        {j.description}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatUSD(j.total_debit || 0)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 6. Suppliers */}
          {results && results.suppliers?.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                <Building2 className="w-3.5 h-3.5 mr-1 text-orange-500" /> Suppliers ({results.suppliers.length})
              </div>
              <div className="space-y-1.5">
                {results.suppliers.map((s: any) => (
                  <Link
                    key={s.id}
                    href="/suppliers"
                    onClick={onClose}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs transition-colors min-h-[44px]"
                  >
                    <span className="font-bold text-slate-900 dark:text-white">
                      {s.supplier_name}
                    </span>
                    <span className="text-slate-400 text-[11px]">{s.country || "Supplier"}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
