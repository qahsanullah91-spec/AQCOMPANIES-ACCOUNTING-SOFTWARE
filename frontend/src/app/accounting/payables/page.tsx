"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface PurchasePayable {
  id: number;
  purchase_code: string;
  date: string;
  supplier_id: number | null;
  supplier_name: string;
  product_name: string;
  packages: number;
  net_kg: number;
  purchase_amount: number | null;
  amount_paid: number;
  balance: number | null;
  cost_display: string;
  status: string;
  shipment_invoice: string | null;
}

export default function SupplierPayablesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetchApi("/accounting/payables/suppliers");
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const summary = data?.summary || {};
  const purchases: PurchasePayable[] = data?.purchases || [];

  const filtered = purchases.filter((p) => {
    const s = search.toLowerCase();
    return (
      p.purchase_code.toLowerCase().includes(s) ||
      p.supplier_name.toLowerCase().includes(s) ||
      p.product_name.toLowerCase().includes(s) ||
      (p.shipment_invoice && p.shipment_invoice.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-sky-600" />
            Accounts Payable (Suppliers)
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Afghan Dry Fruit Procurement Payables & Vendor Invoicing
          </p>
        </div>
      </div>

      <AccountingNav />

      {/* Audit Banner: Zero Financial Fabrication Notice */}
      <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-3">
        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">
            Accounting Integrity Rule: Zero Rate Fabrication
          </div>
          <div className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
            The Excel master workbook logged physical quantities (packages and net kg) for Afghan procurement, but supplier invoice purchase rates were left blank pending Sarafi settlement. These are preserved strictly as <b>PENDING SUPPLIER INVOICE</b>. The system never injects fake $0.00 costs.
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Purchase Orders</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {summary.total_purchases_count || 0} POs
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Procured Dry Fruit Cargo</div>
        </div>

        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            Pending Supplier Invoices
          </div>
          <div className="text-lg font-black text-amber-700 dark:text-amber-300 mt-1">
            {summary.pending_invoices_count || 0} POs
          </div>
          <div className="text-[10px] text-amber-600 font-medium mt-1">Awaiting Sarafi / Afghan Rates</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirmed Payable Balance</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatUSD(summary.confirmed_payable_usd)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Finalized Vendor Bills</div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search PO code, supplier, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-8 w-full"
          />
        </div>
        <div className="text-slate-500 text-[11px]">
          Showing <b>{filtered.length}</b> purchase orders
        </div>
      </div>

      {/* Payables Table */}
      <div className="table-container shadow-2xs">
        <table className="table">
          <thead>
            <tr>
              <th className="w-24">Date</th>
              <th className="w-28">PO Code</th>
              <th>Supplier</th>
              <th>Product Cargo</th>
              <th className="text-right w-24">Packages</th>
              <th className="text-right w-28">Net Weight (KG)</th>
              <th className="text-right w-36">Purchase Cost</th>
              <th className="text-right w-28">Amount Paid</th>
              <th className="text-right w-32">Balance Due</th>
              <th className="text-center w-28">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-slate-400 text-xs">
                  Loading supplier payables...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-slate-400 text-xs">
                  No supplier records found.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                    {p.date}
                  </td>
                  <td className="font-mono font-bold text-sky-600 dark:text-sky-400 text-[11px]">
                    {p.purchase_code}
                  </td>
                  <td>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {p.supplier_name}
                    </div>
                  </td>
                  <td>
                    <div className="text-xs text-slate-800 dark:text-slate-200">
                      {p.product_name}
                    </div>
                    {p.shipment_invoice && (
                      <span className="badge badge-neutral text-[9px] font-mono mt-0.5">
                        Linked: {p.shipment_invoice}
                      </span>
                    )}
                  </td>
                  <td className="text-right font-mono text-xs">
                    {p.packages.toLocaleString()} CTNS
                  </td>
                  <td className="text-right font-mono text-xs">
                    {p.net_kg.toLocaleString()} KG
                  </td>
                  <td className="text-right font-mono text-xs">
                    {p.purchase_amount !== null ? (
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatUSD(p.purchase_amount)}
                      </span>
                    ) : (
                      <span className="badge badge-warning text-[9px]">
                        Pending Supplier Invoice
                      </span>
                    )}
                  </td>
                  <td className="text-right font-mono text-xs text-emerald-600">
                    {p.amount_paid > 0 ? formatUSD(p.amount_paid) : "—"}
                  </td>
                  <td className="text-right font-mono font-bold text-xs">
                    {p.balance !== null ? (
                      formatUSD(p.balance)
                    ) : (
                      <span className="text-slate-400 font-normal">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span
                      className={`badge text-[9px] ${
                        p.purchase_amount === null
                          ? "badge-warning"
                          : p.status === "PAID"
                          ? "badge-success"
                          : "badge-danger"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
