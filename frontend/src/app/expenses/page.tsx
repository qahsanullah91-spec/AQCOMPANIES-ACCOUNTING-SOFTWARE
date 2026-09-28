"use client";

import React, { useEffect, useState } from "react";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingDown,
  Layers,
  FileText,
  Truck,
  Box,
  CheckCircle,
} from "lucide-react";
import { fetchApi, formatUSD, formatRate, formatNumber } from "@/lib/api";

const EXPENSE_CATEGORIES = [
  "Freight / Container Rent",
  "Truck Rent (Afghanistan Local)",
  "Driver Rent",
  "Loading / Labour",
  "Unloading Charges",
  "Weighbridge / Scale Fees",
  "Packaging & Sacks",
  "Phytosanitary Certificate",
  "Certificate of Origin",
  "Afghanistan Customs Clearance",
  "Border Charges (Chaman / Torkham)",
  "Port & Terminal Handling (THC)",
  "Shipping Line Demurrage",
  "Container Detention",
  "Transit & Cargo Insurance",
  "Bank Charges & SWIFT Fees",
  "Sarafi / Hawala Commission",
  "Agent / Broker Commission",
  "Miscellaneous / Other",
];

interface Expense {
  id: number;
  expense_code: string;
  date: string;
  category: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_usd: number;
  shipment_id?: number;
  container_number?: string;
  invoice_id?: number;
  customer_id?: number;
  supplier_id?: number;
  transport_company_id?: number;
  payment_status: string;
  notes?: string;
  created_at: string;
}

interface ShipmentOption {
  id: number;
  shipment_code: string;
  container_number?: string;
  invoice_number: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shipments, setShipments] = useState<ShipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "Port & Terminal Handling (THC)",
    amount: 450,
    currency: "USD",
    exchange_rate: 1.0,
    shipment_id: "",
    container_number: "",
    payment_status: "PAID",
    notes: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [expData, shpData] = await Promise.all([
        fetchApi<Expense[]>("/expenses"),
        fetchApi<ShipmentOption[]>("/shipments"),
      ]);
      setExpenses(expData || []);
      setShipments(shpData || []);
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
    try {
      setSubmitting(true);
      setErrorMsg("");

      const selectedShipment = shipments.find((s) => String(s.id) === formData.shipment_id);

      await fetchApi("/expenses", {
        method: "POST",
        body: JSON.stringify({
          date: formData.date,
          category: formData.category,
          amount: Number(formData.amount),
          currency: formData.currency,
          exchange_rate: Number(formData.exchange_rate),
          shipment_id: formData.shipment_id ? Number(formData.shipment_id) : undefined,
          container_number:
            formData.container_number || selectedShipment?.container_number || undefined,
          payment_status: formData.payment_status,
          notes: formData.notes || undefined,
        }),
      });

      setIsModalOpen(false);
      setFormData({
        date: new Date().toISOString().split("T")[0],
        category: "Port & Terminal Handling (THC)",
        amount: 450,
        currency: "USD",
        exchange_rate: 1.0,
        shipment_id: "",
        container_number: "",
        payment_status: "PAID",
        notes: "",
      });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record expense");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch =
      (exp.expense_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (exp.category || "").toLowerCase().includes(search.toLowerCase()) ||
      (exp.container_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (exp.notes || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter ? exp.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  const totalExpenseUSD = expenses.reduce((acc, e) => acc + Number(e.amount_usd || 0), 0);

  // Grouping by category
  const categoryTotals: { [key: string]: number } = {};
  for (const exp of expenses) {
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + Number(exp.amount_usd || 0);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-7 h-7 text-rose-600" />
            Expense Registry (19 Categories)
          </h1>
          <p className="text-sm text-slate-500">
            Afghanistan Inland Trucking • Customs • Border • Port Handling • Demurrage • Inspection
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary flex items-center gap-2 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          Record Expense
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 bg-white border-l-4 border-l-rose-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Operating Expenses</p>
          <p className="text-2xl font-extrabold text-rose-600 mt-1">{formatUSD(totalExpenseUSD)}</p>
          <p className="text-xs text-slate-500 mt-1">{expenses.length} Recorded Expense Vouchers</p>
        </div>

        <div className="card p-5 bg-white border-l-4 border-l-indigo-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Cost Categories</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{Object.keys(categoryTotals).length} / 19</p>
          <p className="text-xs text-slate-500 mt-1">Trading & Logistics Categories</p>
        </div>

        <div className="card p-5 bg-white border-l-4 border-l-emerald-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Status</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">100% Settled</p>
          <p className="text-xs text-slate-500 mt-1">Disbursed via Bank & Cash</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card p-4 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search expense code, container, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-sm w-full"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="select text-sm w-full md:w-72"
          >
            <option value="">All 19 Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card overflow-hidden bg-white shadow-sm">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Code / Date</th>
                <th>Category</th>
                <th>Linked Cargo</th>
                <th className="text-right">Original Amount</th>
                <th className="text-right">FX Rate</th>
                <th className="text-right">Amount (USD)</th>
                <th>Status</th>
                <th>Remarks / Description</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    Loading expenses...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="font-semibold text-slate-900">
                      <div>{exp.expense_code}</div>
                      <div className="text-xs text-slate-400 font-normal">{exp.date}</div>
                    </td>
                    <td>
                      <span className="badge badge-neutral text-xs font-semibold">{exp.category}</span>
                    </td>
                    <td className="text-xs">
                      {exp.container_number && (
                        <div className="font-mono font-bold text-sky-600">{exp.container_number}</div>
                      )}
                      {exp.shipment_id && (
                        <div className="text-slate-500">Shipment #{exp.shipment_id}</div>
                      )}
                      {!exp.container_number && !exp.shipment_id && (
                        <span className="text-slate-400">General Overhead</span>
                      )}
                    </td>
                    <td className="text-right font-medium text-slate-700">
                      {exp.currency} {Number(exp.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right font-mono text-xs text-slate-500">
                      {Number(exp.exchange_rate).toFixed(4)}
                    </td>
                    <td className="text-right font-bold text-rose-600">{formatUSD(exp.amount_usd)}</td>
                    <td>
                      <span className="badge badge-success text-[11px] flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> {exp.payment_status}
                      </span>
                    </td>
                    <td className="text-xs text-slate-600 max-w-xs truncate">{exp.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record Operational Expense</h3>
                <p className="text-xs text-slate-500">
                  Select from 19 standard logistics & trading cost categories
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
                  <label className="label">Expense Category *</label>
                  <select
                    className="select text-sm w-full font-semibold"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Date *</label>
                  <input
                    type="date"
                    className="input text-sm w-full"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Currency *</label>
                  <select
                    className="select text-sm w-full font-bold"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="AFN">AFN - Afghan Afghani</option>
                    <option value="AED">AED - UAE Dirham</option>
                  </select>
                </div>

                <div>
                  <label className="label">Exchange Rate to USD</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="input text-sm w-full"
                    value={formData.exchange_rate}
                    onChange={(e) => setFormData({ ...formData, exchange_rate: Number(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Expense Amount ({formData.currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input text-base font-bold w-full"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <label className="label">USD Equivalent</label>
                  <div className="input bg-slate-50 font-black text-rose-600 flex items-center">
                    {formData.currency === "INR" || formData.currency === "AFN"
                      ? formatUSD(formData.amount / (formData.exchange_rate || 1))
                      : formatUSD(formData.amount * (formData.exchange_rate || 1))}
                  </div>
                </div>

                <div>
                  <label className="label">Link to Shipment (Optional)</label>
                  <select
                    className="select text-sm w-full"
                    value={formData.shipment_id}
                    onChange={(e) => {
                      const shp = shipments.find((s) => String(s.id) === e.target.value);
                      setFormData({
                        ...formData,
                        shipment_id: e.target.value,
                        container_number: shp?.container_number || formData.container_number,
                      });
                    }}
                  >
                    <option value="">General Overhead (Not linked)</option>
                    {shipments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shipment_code} - {s.invoice_number} ({s.container_number || "No Container"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Container Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. MRKU1234567"
                    className="input text-sm w-full font-mono uppercase"
                    value={formData.container_number}
                    onChange={(e) => setFormData({ ...formData, container_number: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Description / Receipt Notes</label>
                <textarea
                  rows={2}
                  className="textarea text-sm w-full"
                  placeholder="Receipt number, paid to person/broker, border post..."
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
                  {submitting ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
