"use client";

import React, { useEffect, useState } from "react";
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Package,
  DollarSign,
  CheckCircle,
  Clock,
  FileText,
  AlertCircle,
} from "lucide-react";
import { fetchApi, formatUSD, formatRate, formatWeight, formatNumber } from "@/lib/api";

interface Purchase {
  id: number;
  purchase_code: string;
  date: string;
  supplier_id: number;
  supplier_name?: string;
  purchase_reference?: string;
  shipment_invoice?: string;
  customer_name?: string;
  product_name: string;
  product_grade?: string;
  packages: number;
  net_kg: number;
  purchase_rate: number;
  purchase_amount: number;
  currency: string;
  amount_paid: number;
  balance: number;
  payment_method: string;
  bank_account?: string;
  payment_reference?: string;
  notes?: string;
}

interface Supplier {
  id: number;
  supplier_name: string;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    supplier_id: "",
    purchase_reference: "",
    date: new Date().toISOString().split("T")[0],
    product_name: "Dried Figs (Injeer)",
    product_grade: "Grade AAA Jumbo",
    packages: 1000,
    net_kg: 10000,
    purchase_rate: 6.20,
    currency: "USD",
    payment_method: "Sarafi / Exchange",
    payment_reference: "",
    shipment_invoice: "",
    notes: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [purData, supData] = await Promise.all([
        fetchApi<Purchase[]>("/purchases"),
        fetchApi<Supplier[]>("/suppliers"),
      ]);
      setPurchases(purData || []);
      setSuppliers(supData || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_id) {
      setErrorMsg("Please select a supplier");
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg("");
      await fetchApi("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: Number(formData.supplier_id),
          date: formData.date,
          purchase_reference: formData.purchase_reference || undefined,
          shipment_invoice: formData.shipment_invoice || undefined,
          product_name: formData.product_name,
          product_grade: formData.product_grade,
          packages: Number(formData.packages),
          net_kg: Number(formData.net_kg),
          purchase_rate: Number(formData.purchase_rate),
          currency: formData.currency,
          payment_method: formData.payment_method,
          payment_reference: formData.payment_reference || undefined,
          notes: formData.notes || undefined,
        }),
      });
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create purchase");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      (p.purchase_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.supplier_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.product_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.purchase_reference || "").toLowerCase().includes(search.toLowerCase());
    const matchesSupplier = supplierFilter ? String(p.supplier_id) === supplierFilter : true;
    return matchesSearch && matchesSupplier;
  });

  const totalAmount = purchases.reduce((acc, p) => acc + Number(p.purchase_amount || 0), 0);
  const totalPaid = purchases.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0);
  const totalOutstanding = purchases.reduce((acc, p) => acc + Number(p.balance || 0), 0);
  const totalWeight = purchases.reduce((acc, p) => acc + Number(p.net_kg || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-amber-600" />
            Purchase Ledger
          </h1>
          <p className="text-sm text-slate-500">
            Afghanistan Dry Fruit Procurement • Supplier Contracts • Sarafi & Bank Settlements
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/excel/export?entity=purchases"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary flex items-center gap-2 text-xs font-semibold"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </a>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary flex items-center gap-2 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            Record Purchase
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-white border-l-4 border-l-amber-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Purchases</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{formatUSD(totalAmount)}</p>
          <p className="text-xs text-slate-500 mt-1">{purchases.length} Recorded Invoices</p>
        </div>
        <div className="card p-5 bg-white border-l-4 border-l-emerald-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Paid to Suppliers</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{formatUSD(totalPaid)}</p>
          <p className="text-xs text-slate-500 mt-1">Via Bank & Sarafi</p>
        </div>
        <div className="card p-5 bg-white border-l-4 border-l-rose-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier Payable Due</p>
          <p className="text-2xl font-extrabold text-rose-600 mt-1">{formatUSD(totalOutstanding)}</p>
          <p className="text-xs text-slate-500 mt-1">Outstanding Balance</p>
        </div>
        <div className="card p-5 bg-white border-l-4 border-l-indigo-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Volume</p>
          <p className="text-2xl font-extrabold text-indigo-600 mt-1">{formatWeight(totalWeight)}</p>
          <p className="text-xs text-slate-500 mt-1">Dry Fruit Procured</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by code, supplier, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-sm w-full"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="select text-sm w-full md:w-60"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.supplier_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Purchase Table */}
      <div className="card overflow-hidden bg-white shadow-sm">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Code / Date</th>
                <th>Supplier</th>
                <th>Product & Grade</th>
                <th className="text-right">Packages</th>
                <th className="text-right">Net Weight</th>
                <th className="text-right">Purchase Rate</th>
                <th className="text-right">Total Amount</th>
                <th className="text-right">Amount Paid</th>
                <th className="text-right">Balance Due</th>
                <th>Payment Method</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-slate-400">
                    Loading purchase records...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-slate-400">
                    No purchase records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => {
                  const isPaid = Number(p.balance) <= 0 && Number(p.amount_paid) > 0;
                  const isPartial = Number(p.amount_paid) > 0 && Number(p.balance) > 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="font-semibold text-slate-900">
                        <div>{p.purchase_code}</div>
                        <div className="text-xs text-slate-400 font-normal">{p.date}</div>
                      </td>
                      <td className="font-medium text-slate-800">
                        {p.supplier_name || `Supplier #${p.supplier_id}`}
                      </td>
                      <td>
                        <div className="font-medium text-slate-800">{p.product_name}</div>
                        {p.product_grade && (
                          <div className="text-xs text-slate-500">{p.product_grade}</div>
                        )}
                      </td>
                      <td className="text-right font-medium">{formatNumber(p.packages)} CTNS</td>
                      <td className="text-right font-medium text-slate-700">{formatWeight(p.net_kg)}</td>
                      <td className="text-right font-mono font-medium text-slate-900">
                        {formatRate(p.purchase_rate)}
                      </td>
                      <td className="text-right font-semibold text-slate-900">
                        {formatUSD(p.purchase_amount)}
                      </td>
                      <td className="text-right font-medium text-emerald-600">
                        {formatUSD(p.amount_paid)}
                      </td>
                      <td className="text-right font-bold text-rose-600">
                        {formatUSD(p.balance)}
                      </td>
                      <td>
                        <span className="badge badge-neutral text-xs">
                          {p.payment_method || "Bank Transfer"}
                        </span>
                      </td>
                      <td>
                        {isPaid ? (
                          <span className="badge badge-success text-xs flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Paid
                          </span>
                        ) : isPartial ? (
                          <span className="badge badge-warning text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Partial
                          </span>
                        ) : (
                          <span className="badge badge-danger text-xs flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Unpaid
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Purchase Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record New Purchase</h3>
                <p className="text-xs text-slate-500">
                  Enter dry fruit procurement details from Afghanistan supplier
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
                <div>
                  <label className="label">Supplier *</label>
                  <select
                    className="select text-sm w-full"
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    required
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Purchase Date *</label>
                  <input
                    type="date"
                    className="input text-sm w-full"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Product Name *</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Grade / Variety</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    value={formData.product_grade}
                    onChange={(e) => setFormData({ ...formData, product_grade: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Packages / Cartons *</label>
                  <input
                    type="number"
                    className="input text-sm w-full"
                    value={formData.packages}
                    onChange={(e) => setFormData({ ...formData, packages: Number(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Net Weight (KG) *</label>
                  <input
                    type="number"
                    step="0.001"
                    className="input text-sm w-full"
                    value={formData.net_kg}
                    onChange={(e) => setFormData({ ...formData, net_kg: Number(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Purchase Rate ($/KG) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="input text-sm w-full"
                    value={formData.purchase_rate}
                    onChange={(e) => setFormData({ ...formData, purchase_rate: Number(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Total Purchase Cost</label>
                  <div className="input bg-slate-50 text-slate-800 font-bold flex items-center">
                    {formatUSD(formData.net_kg * formData.purchase_rate)}
                  </div>
                </div>

                <div>
                  <label className="label">Payment Method</label>
                  <select
                    className="select text-sm w-full"
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  >
                    <option value="Sarafi / Exchange">Sarafi / Hawala Exchange</option>
                    <option value="Bank Transfer">Bank Wire / Transfer</option>
                    <option value="Cash">Cash in Kabul</option>
                    <option value="Other">Other Settlement</option>
                  </select>
                </div>

                <div>
                  <label className="label">Payment / Hawala Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarafi Kabul Ticket #8841"
                    className="input text-sm w-full"
                    value={formData.payment_reference}
                    onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Notes / Supplier Terms</label>
                <textarea
                  rows={2}
                  className="textarea text-sm w-full"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Terms agreed, packaging instructions, etc."
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
                  {submitting ? "Saving..." : "Save Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
