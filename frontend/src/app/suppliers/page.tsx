"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Truck,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  DollarSign,
  Briefcase,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  FileText,
} from "lucide-react";
import { fetchApi, formatUSD, formatRate, formatWeight, formatNumber } from "@/lib/api";

interface SupplierProfile {
  id: number;
  supplier_name: string;
  contact_person?: string;
  address?: string;
  country?: string;
  phone?: string;
  email?: string;
  sarafi_details?: string;
  bank_details?: string;
  notes?: string;
}

interface SupplierSummary {
  total_purchases: number;
  total_paid: number;
  supplier_payable: number;
  total_kg_purchased: number;
  average_purchase_rate: number;
}

interface SupplierLedgerEntry {
  date: string;
  purchase_reference: string;
  shipment?: string;
  product?: string;
  purchase_amount: number;
  payment: number;
  balance?: number;
  payment_method?: string;
  notes?: string;
}

interface SupplierDetailResponse {
  profile: SupplierProfile;
  summary: SupplierSummary;
  ledger: SupplierLedgerEntry[];
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [supplierDetail, setSupplierDetail] = useState<SupplierDetailResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    supplier_name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "Mandawi Market, Kabul, Afghanistan",
    country: "Afghanistan",
    sarafi_details: "Sarafi Shahzada Kabul - Account: Haji Noorullah #4521",
    bank_details: "Kabul Bank - Account: 0012345678",
    notes: "",
  });

  const loadSuppliers = async () => {
    try {
      setLoadingList(true);
      const data = await fetchApi<SupplierProfile[]>("/suppliers");
      setSuppliers(data || []);
      if (data && data.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  const loadSupplierDetail = async (id: number) => {
    try {
      setLoadingDetail(true);
      const detail = await fetchApi<SupplierDetailResponse>(`/suppliers/${id}/ledger`);
      setSupplierDetail(detail);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (selectedSupplierId) {
      loadSupplierDetail(selectedSupplierId);
    }
  }, [selectedSupplierId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg("");
      const created = await fetchApi<SupplierProfile>("/suppliers", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      setFormData({
        supplier_name: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "Mandawi Market, Kabul, Afghanistan",
        country: "Afghanistan",
        sarafi_details: "",
        bank_details: "",
        notes: "",
      });
      await loadSuppliers();
      if (created?.id) setSelectedSupplierId(created.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create supplier");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_person || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.address || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-amber-600" />
            Supplier Accounts & Sarafi Ledger
          </h1>
          <p className="text-sm text-slate-500">
            Afghanistan Dry Fruit Suppliers • Sarafi & Hawala Details • Running Payable Balance
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary flex items-center gap-2 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Supplier Directory */}
        <div className="lg:col-span-4 space-y-4">
          <div className="card p-3 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search suppliers, contact, city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 text-xs w-full"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[700px] overflow-y-auto">
            {loadingList ? (
              <div className="card p-6 text-center text-slate-400 text-xs">Loading suppliers...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="card p-6 text-center text-slate-400 text-xs">No suppliers found</div>
            ) : (
              filteredSuppliers.map((supp) => {
                const isSelected = supp.id === selectedSupplierId;
                return (
                  <div
                    key={supp.id}
                    onClick={() => setSelectedSupplierId(supp.id)}
                    className={`card p-4 cursor-pointer transition-all border ${
                      isSelected
                        ? "border-amber-600 bg-amber-50/40 shadow-sm ring-1 ring-amber-500"
                        : "hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-sm">{supp.supplier_name}</div>
                      <ChevronRight
                        className={`w-4 h-4 ${isSelected ? "text-amber-600" : "text-slate-400"}`}
                      />
                    </div>
                    {supp.contact_person && (
                      <div className="text-xs text-slate-600 mt-0.5">{supp.contact_person}</div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 font-mono">
                      {supp.phone && <span>{supp.phone}</span>}
                      {supp.address && <span>{supp.address}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Supplier Details & Running Ledger */}
        <div className="lg:col-span-8 space-y-6">
          {loadingDetail || !supplierDetail ? (
            <div className="card p-12 text-center text-slate-400">Loading supplier account details...</div>
          ) : (
            <>
              {/* Profile Card */}
              <div className="card p-6 bg-white shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b pb-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {supplierDetail.profile.supplier_name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                      {supplierDetail.profile.contact_person && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {supplierDetail.profile.contact_person}
                        </span>
                      )}
                      {supplierDetail.profile.phone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5" />
                          {supplierDetail.profile.phone}
                        </span>
                      )}
                      {supplierDetail.profile.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {supplierDetail.profile.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="badge badge-warning px-3 py-1 font-semibold text-xs">
                    Origin: {supplierDetail.profile.country || "Afghanistan"}
                  </span>
                </div>

                {/* Settlement Details (Sarafi & Bank) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-amber-800 uppercase font-bold block">
                      Sarafi / Hawala Account Details
                    </span>
                    <p className="font-mono text-slate-800 mt-1">
                      {supplierDetail.profile.sarafi_details || "No Sarafi registered"}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Direct Bank Wire Instructions
                    </span>
                    <p className="font-mono text-slate-800 mt-1">
                      {supplierDetail.profile.bank_details || "No direct bank wire info"}
                    </p>
                  </div>
                </div>

                {/* Financial KPI Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-white dark:bg-slate-900 border-l-4 border-l-rose-500 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Known Payable</span>
                    <span className="text-lg font-black text-rose-600 mt-0.5 block font-mono tabular-nums">
                      {formatUSD(supplierDetail.summary.supplier_payable)}
                    </span>
                    <span className="text-[10px] text-slate-500">Recorded Invoices Due</span>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Paid to Supplier</span>
                    <span className="text-lg font-black text-emerald-600 mt-0.5 block font-mono tabular-nums">
                      {formatUSD(supplierDetail.summary.total_paid)}
                    </span>
                    <span className="text-[10px] text-slate-500">Settled via Sarafi / Wire</span>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Advance Overpaid</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5 block font-mono tabular-nums">
                      $0.00
                    </span>
                    <span className="text-[10px] text-slate-500">Prepayment Balance</span>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 border-l-4 border-l-amber-500 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Cost</span>
                    <span className="text-xs font-bold text-amber-600 mt-1 block font-mono">
                      63 Shipments Pending
                    </span>
                    <span className="text-[10px] text-slate-400">Costs Preserved NULL</span>
                  </div>
                </div>

                {/* Mobile & Universal Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href="/purchases"
                    className="btn btn-secondary text-xs flex items-center gap-1.5 font-bold py-2 px-3.5 min-h-[40px]"
                  >
                    <Receipt className="w-3.5 h-3.5 text-amber-600" /> Bills
                  </Link>
                  <Link
                    href={`/payables?supplier_id=${supplierDetail.profile.id}`}
                    className="btn btn-primary text-xs flex items-center gap-1.5 font-bold py-2 px-3.5 min-h-[40px]"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Payments
                  </Link>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-secondary text-xs flex items-center gap-1.5 font-bold py-2 px-3.5 min-h-[40px]"
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-600" /> Statement
                  </button>
                </div>
              </div>

              {/* Running Ledger */}
              <div className="card overflow-hidden bg-white shadow-sm space-y-3">
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Supplier Statement & Payment Journal
                    </h3>
                    <p className="text-xs text-slate-500">
                      Purchases increase payable; payments reduce payable balance
                    </p>
                  </div>
                </div>

                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Product / Shipment</th>
                        <th className="text-right">Purchase Cost</th>
                        <th className="text-right">Paid to Supplier</th>
                        <th className="text-right">Balance Due</th>
                        <th>Payment Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierDetail.ledger.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400">
                            No ledger entries recorded yet for this supplier.
                          </td>
                        </tr>
                      ) : (
                        supplierDetail.ledger.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="text-xs text-slate-600 font-mono font-medium">{entry.date}</td>
                            <td className="font-semibold text-slate-900">{entry.purchase_reference}</td>
                            <td className="text-slate-700 text-xs">
                              <div>{entry.product || "Dry Fruit Purchase"}</div>
                              {entry.shipment && <div className="text-slate-400 font-mono">{entry.shipment}</div>}
                            </td>
                            <td className="text-right font-medium text-slate-900">
                              {entry.purchase_amount > 0 ? (
                                <span className="text-slate-900 font-bold">{formatUSD(entry.purchase_amount)}</span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="text-right font-medium text-emerald-600">
                              {entry.payment > 0 ? (
                                <span className="text-emerald-700 font-bold">{formatUSD(entry.payment)}</span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="text-right font-extrabold text-slate-900">
                              <span
                                className={
                                  (entry.balance || 0) > 0
                                    ? "text-rose-600"
                                    : (entry.balance || 0) < 0
                                    ? "text-emerald-600"
                                    : "text-slate-600"
                                }
                              >
                                {formatUSD(entry.balance)}
                              </span>
                            </td>
                            <td className="text-xs text-slate-500 font-medium">
                              {entry.payment_method || "Bank Wire / Sarafi"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add New Supplier</h3>
                <p className="text-xs text-slate-500">
                  Register Afghanistan dry fruit merchant & Sarafi accounts
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label">Supplier / Trading Firm Name *</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="e.g. Haji Noorullah Dry Fruit Trading Kabul"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Contact Person</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="e.g. Haji Noorullah"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Phone / WhatsApp</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="+93 79 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label">Address / Location</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="Mandawi Market, Kabul, Afghanistan"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label">Sarafi / Hawala Exchange Details</label>
                  <input
                    type="text"
                    className="input text-sm w-full font-mono text-xs"
                    placeholder="e.g. Sarafi Shahzada Kabul - Account: Haji Noorullah #4521"
                    value={formData.sarafi_details}
                    onChange={(e) => setFormData({ ...formData, sarafi_details: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label">Bank Account Details (Optional)</label>
                  <input
                    type="text"
                    className="input text-sm w-full font-mono text-xs"
                    placeholder="e.g. Kabul Bank - Account: 0012345678"
                    value={formData.bank_details}
                    onChange={(e) => setFormData({ ...formData, bank_details: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Notes / Quality Remarks</label>
                <textarea
                  rows={2}
                  className="textarea text-sm w-full"
                  placeholder="Specialty products, payment arrangements, packaging standards..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-sm flex items-center gap-2"
                >
                  {submitting ? "Saving..." : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
