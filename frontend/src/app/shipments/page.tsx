"use client";

import React, { useState, useEffect } from "react";
import {
  Ship,
  Plus,
  Search,
  Download,
  Upload,
  Filter,
  Eye,
  Edit,
  Trash2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  FileSpreadsheet,
} from "lucide-react";
import {
  fetchApi,
  formatUSD,
  formatRate,
  formatWeight,
  formatNumber,
  API_BASE,
} from "@/lib/api";

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [transports, setTransports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  // Excel Import state
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelPreview, setExcelPreview] = useState<any>(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelMsg, setExcelMsg] = useState("");

  // Form State
  const [formData, setFormData] = useState<any>({
    shipment_code: "",
    shipment_date: new Date().toISOString().split("T")[0],
    invoice_number: "",
    invoice_date: new Date().toISOString().split("T")[0],
    customer_id: "",
    supplier_id: "",
    transport_company_id: "",
    product_summary: "Black Raisins Best",
    product_grade: "Premium AAA",
    packages: 2000,
    cartons: 2000,
    package_type: "CTNS",
    net_weight_kg: 20000,
    gross_weight_kg: 21200,
    rate_per_kg: 3.50,
    purchase_rate: 2.20,
    transport_freight: 6000,
    afghanistan_truck_cost: 1500,
    driver_rent: 400,
    customs_cost: 1000,
    documentation_cost: 300,
    border_cost: 500,
    bank_charges: 120,
    commission: 400,
    other_expenses: 150,
    container_number: "",
    container_type: "40ft HQ",
    bl_number: "",
    truck_number: "",
    driver_name: "",
    origin: "Kabul, Afghanistan",
    route: "Chaman - Karachi - Nhava Sheva",
    destination: "Delhi / Nhava Sheva, India",
    status: "IN TRANSIT",
    notes: "",
  });

  async function loadData() {
    setLoading(true);
    try {
      const [sData, cData, supData, tData] = await Promise.all([
        fetchApi<any[]>("/shipments"),
        fetchApi<any[]>("/customers"),
        fetchApi<any[]>("/suppliers"),
        fetchApi<any[]>("/transport-companies"),
      ]);
      setShipments(sData);
      setCustomers(cData);
      setSuppliers(supData);
      setTransports(tData);
      if (cData.length > 0 && !formData.customer_id) {
        setFormData((prev: any) => ({ ...prev, customer_id: cData[0].id }));
      }
    } catch (err) {
      console.error("Failed to load shipments:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Duplicate check on blur
  const checkDuplicate = async () => {
    if (!formData.invoice_number && !formData.container_number && !formData.bl_number) return;
    try {
      const res: any = await fetchApi("/shipments/check-duplicate", {
        method: "POST",
        body: JSON.stringify({
          invoice_number: formData.invoice_number,
          customer_id: formData.customer_id ? Number(formData.customer_id) : null,
          container_number: formData.container_number,
          bl_number: formData.bl_number,
          truck_number: formData.truck_number,
          exclude_id: selectedShipment?.id || null,
        }),
      });
      if (res.is_duplicate) {
        setDuplicateWarning(res.warnings[0].message);
      } else {
        setDuplicateWarning(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        customer_id: Number(formData.customer_id),
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        transport_company_id: formData.transport_company_id ? Number(formData.transport_company_id) : null,
        net_weight_kg: Number(formData.net_weight_kg),
        rate_per_kg: Number(formData.rate_per_kg),
        purchase_rate: Number(formData.purchase_rate),
        cartons: Number(formData.cartons),
        packages: Number(formData.packages),
        transport_freight: Number(formData.transport_freight),
        afghanistan_truck_cost: Number(formData.afghanistan_truck_cost),
        driver_rent: Number(formData.driver_rent),
        customs_cost: Number(formData.customs_cost),
        documentation_cost: Number(formData.documentation_cost),
        border_cost: Number(formData.border_cost),
        bank_charges: Number(formData.bank_charges),
        commission: Number(formData.commission),
        other_expenses: Number(formData.other_expenses),
      };

      if (selectedShipment) {
        await fetchApi(`/shipments/${selectedShipment.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await fetchApi("/shipments", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setIsModalOpen(false);
      setSelectedShipment(null);
      setDuplicateWarning(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to save shipment");
    }
  };

  const filteredShipments = shipments.filter((s) => {
    const matchSearch =
      !search ||
      s.shipment_code.toLowerCase().includes(search.toLowerCase()) ||
      s.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      (s.container_number && s.container_number.toLowerCase().includes(search.toLowerCase())) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(search.toLowerCase())) ||
      s.product_summary.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setExcelUploading(true);
      setExcelMsg("");
      const body = new FormData();
      body.append("file", file);
      body.append("entity", "shipments");
      const res = await fetch(`${API_BASE}/excel/preview`, {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error("Failed to parse Excel file");
      const data = await res.json();
      setExcelPreview(data);
    } catch (err: any) {
      setExcelMsg(err.message || "Failed to preview Excel");
    } finally {
      setExcelUploading(false);
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelPreview || !excelPreview.new_records) return;
    try {
      setExcelImporting(true);
      await fetchApi("/excel/confirm-import", {
        method: "POST",
        body: JSON.stringify({
          entity: "shipments",
          records: excelPreview.new_records,
        }),
      });
      setExcelMsg(`Successfully imported ${excelPreview.new_records.length} shipment(s)!`);
      setExcelPreview(null);
      loadData();
    } catch (err: any) {
      setExcelMsg(err.message || "Import failed");
    } finally {
      setExcelImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Master Shipment Ledger
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
              ONE ROW = ONE CONTAINER
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Full Container Accounting • Real-time Profit • Customer & Transport Balances
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => {
              setExcelMsg("");
              setExcelPreview(null);
              setIsExcelModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-sky-600" />
            <span>Import Excel</span>
          </button>

          <a
            href="${API_BASE}/excel/export?entity=shipments"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </a>

          <button
            onClick={() => {
              setSelectedShipment(null);
              setDuplicateWarning(null);
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Shipment</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by invoice, container, BL, customer, product..."
            className="w-full bg-transparent border-0 outline-hidden text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-200 outline-hidden"
          >
            <option value="">All Statuses</option>
            <option value="LOADING">LOADING</option>
            <option value="IN TRANSIT">IN TRANSIT</option>
            <option value="AT BORDER">AT BORDER</option>
            <option value="AT PORT">AT PORT</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>
      </div>

      {/* Master Accounting Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap sticky-header">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                <th className="p-2.5 pl-4 border-b border-slate-200 dark:border-slate-800">Shipment ID</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Date</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Invoice No</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Customer</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Product</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right">Cartons</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right">Net KG</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right">Rate / KG</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right bg-sky-100/70 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">Invoice Value</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right">Purchase Rate</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right">Purchase Cost</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right">Transport Freight</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right">Total Cost</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Net Profit</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right">Profit / KG</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right">Profit %</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Container No</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">BL No</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Transport Co</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right">Cust Received</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right text-rose-600 dark:text-rose-300">Cust Balance</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800 text-right">Trans Balance</th>
                <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Status</th>
                <th className="p-2.5 pr-4 border-b border-slate-200 dark:border-slate-800 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={24} className="p-8 text-center text-slate-400">
                    Loading Master Shipment Ledger...
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={24} className="p-8 text-center text-slate-400">
                    No shipments match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredShipments.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-2.5 pl-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                      {s.shipment_code}
                    </td>
                    <td className="p-2.5 text-slate-500">{s.shipment_date}</td>
                    <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">{s.invoice_number}</td>
                    <td className="p-2.5 font-medium max-w-[150px] truncate" title={s.customer_name}>
                      {s.customer_name}
                    </td>
                    <td className="p-2.5 max-w-[180px] truncate text-slate-600 dark:text-slate-300" title={s.product_summary}>
                      {s.product_summary}
                    </td>
                    <td className="p-2.5 text-right font-mono">{formatNumber(s.cartons)}</td>
                    <td className="p-2.5 text-right font-mono">{formatWeight(s.net_weight_kg)}</td>
                    <td className="p-2.5 text-right font-mono">
                      {s.rate_per_kg !== null ? formatRate(s.rate_per_kg) : <span className="text-amber-600 dark:text-amber-400 italic">Pending</span>}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20">
                      {s.invoice_value !== null ? formatUSD(s.invoice_value) : <span className="text-amber-600 dark:text-amber-400 font-semibold">Unpriced</span>}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-500">
                      {s.purchase_rate !== null ? formatRate(s.purchase_rate) : <span className="text-slate-400 dark:text-slate-500 italic">—</span>}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                      {s.purchase_cost !== null ? formatUSD(s.purchase_cost) : <span className="text-slate-400 dark:text-slate-500 italic">Pending</span>}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatUSD(s.transport_freight)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {formatUSD(s.total_cost)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold bg-emerald-50/50 dark:bg-emerald-950/20">
                      {s.net_profit !== null ? (
                        <span className="text-emerald-600 dark:text-emerald-400">{formatUSD(s.net_profit)}</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-normal italic">Pending Cost</span>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {s.profit_per_kg !== null ? formatRate(s.profit_per_kg) : "—"}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {s.profit_margin_pct !== null ? `${s.profit_margin_pct}%` : "—"}
                    </td>
                    <td className="p-2.5 font-mono font-medium text-slate-800 dark:text-slate-200">{s.container_number || "—"}</td>
                    <td className="p-2.5 font-mono text-slate-500">{s.bl_number || "—"}</td>
                    <td className="p-2.5 max-w-[120px] truncate" title={s.transport_company_name}>
                      {s.transport_company_name || "—"}
                    </td>
                    <td className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatUSD(s.customer_amount_received)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{formatUSD(s.customer_balance)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{formatUSD(s.transport_balance)}</td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.status === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : s.status === "IN TRANSIT"
                            ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="p-2.5 pr-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <a
                          href={`${API_BASE}/invoices/${s.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-slate-400 hover:text-sky-600"
                          title="Download Commercial Invoice PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => {
                            setSelectedShipment(s);
                            setFormData({
                              ...s,
                              customer_id: s.customer_id,
                              supplier_id: s.supplier_id || "",
                              transport_company_id: s.transport_company_id || "",
                            });
                            setIsModalOpen(true);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Edit Shipment"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipment Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center space-x-2">
                <Ship className="w-5 h-5 text-sky-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {selectedShipment ? `Edit Shipment ${selectedShipment.shipment_code}` : "New Container Shipment"}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {duplicateWarning && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl flex items-center space-x-2 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{duplicateWarning}</span>
                </div>
              )}

              {/* Basic Information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Invoice Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.invoice_number}
                    onBlur={checkDuplicate}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    placeholder="INV-AQ-2026-..."
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Customer (Buyer) *</label>
                  <select
                    required
                    value={formData.customer_id}
                    onChange={(e) => {
                      setFormData({ ...formData, customer_id: e.target.value });
                      checkDuplicate();
                    }}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select Buyer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name} ({c.country})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product & Weight Information */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Product Summary *</label>
                  <input
                    type="text"
                    required
                    value={formData.product_summary}
                    onChange={(e) => setFormData({ ...formData, product_summary: e.target.value })}
                    placeholder="e.g. Black Raisins Best (20,000 KG)"
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Cartons *</label>
                  <input
                    type="number"
                    required
                    value={formData.cartons}
                    onChange={(e) => setFormData({ ...formData, cartons: e.target.value, packages: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Net Weight KG *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={formData.net_weight_kg}
                    onChange={(e) => setFormData({ ...formData, net_weight_kg: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Financial Pricing (Selling vs Purchase) */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Selling Rate / KG (USD) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.rate_per_kg}
                    onChange={(e) => setFormData({ ...formData, rate_per_kg: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Sales Value</label>
                  <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs font-mono font-bold text-sky-700 dark:text-sky-300">
                    {formatUSD(Number(formData.net_weight_kg || 0) * Number(formData.rate_per_kg || 0))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Purchase Rate / KG (USD) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.purchase_rate}
                    onChange={(e) => setFormData({ ...formData, purchase_rate: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Purchase Cost</label>
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {formatUSD(Number(formData.net_weight_kg || 0) * Number(formData.purchase_rate || 0))}
                  </div>
                </div>
              </div>

              {/* Logistics & Container Details */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Container Number</label>
                  <input
                    type="text"
                    value={formData.container_number}
                    onBlur={checkDuplicate}
                    onChange={(e) => setFormData({ ...formData, container_number: e.target.value })}
                    placeholder="MSCU1234567"
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">BL Number</label>
                  <input
                    type="text"
                    value={formData.bl_number}
                    onBlur={checkDuplicate}
                    onChange={(e) => setFormData({ ...formData, bl_number: e.target.value })}
                    placeholder="MEDU123456"
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Truck Number</label>
                  <input
                    type="text"
                    value={formData.truck_number}
                    onBlur={checkDuplicate}
                    onChange={(e) => setFormData({ ...formData, truck_number: e.target.value })}
                    placeholder="AFG-KBL-..."
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Transport Company</label>
                  <select
                    value={formData.transport_company_id}
                    onChange={(e) => setFormData({ ...formData, transport_company_id: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select Carrier...</option>
                    {transports.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.company_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Logistics Costs Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Transport Freight ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.transport_freight}
                    onChange={(e) => setFormData({ ...formData, transport_freight: e.target.value })}
                    className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Afghanistan Truck ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.afghanistan_truck_cost}
                    onChange={(e) => setFormData({ ...formData, afghanistan_truck_cost: e.target.value })}
                    className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Customs Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.customs_cost}
                    onChange={(e) => setFormData({ ...formData, customs_cost: e.target.value })}
                    className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="LOADING">LOADING</option>
                    <option value="IN TRANSIT">IN TRANSIT</option>
                    <option value="AT BORDER">AT BORDER</option>
                    <option value="AT PORT">AT PORT</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-xs"
                >
                  {selectedShipment ? "Save Changes" : "Create Shipment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 my-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Import Accounting Excel Workbook
                  </h3>
                  <p className="text-xs text-slate-500">
                    Preview records, detect duplicates, and safely import without overwriting data
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExcelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {excelMsg && (
              <div className="p-3 bg-sky-50 border border-sky-200 text-sky-800 text-xs rounded-lg font-medium">
                {excelMsg}
              </div>
            )}

            {/* File Selector */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center space-y-3">
              <Upload className="w-8 h-8 mx-auto text-slate-400" />
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Select your Shipment Ledger spreadsheet (.xlsx, .xls)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Headers accepted: Invoice No, Container No, BL No, Product, Cartons, Net KG, Rate, Freight
                </p>
              </div>

              <label className="btn btn-primary inline-flex items-center space-x-2 text-xs font-semibold cursor-pointer px-4 py-2">
                <span>{excelUploading ? "Parsing Spreadsheet..." : "Choose Excel File"}</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  disabled={excelUploading}
                  onChange={handleExcelFileSelect}
                />
              </label>
            </div>

            {/* Preview Section */}
            {excelPreview && (
              <div className="space-y-4">
                {/* Stats Bar */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Rows</span>
                    <span className="text-base font-black text-slate-900 dark:text-slate-100">
                      {excelPreview.total_rows}
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 uppercase block font-bold">New Records</span>
                    <span className="text-base font-black text-emerald-600">
                      {excelPreview.new_records.length}
                    </span>
                  </div>
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-amber-700 uppercase block font-bold">Duplicates</span>
                    <span className="text-base font-black text-amber-600">
                      {excelPreview.duplicates.length}
                    </span>
                  </div>
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200">
                    <span className="text-[10px] text-rose-700 uppercase block font-bold">Errors / Skip</span>
                    <span className="text-base font-black text-rose-600">
                      {excelPreview.errors.length + excelPreview.skipped.length}
                    </span>
                  </div>
                </div>

                {/* Duplicates Warning */}
                {excelPreview.duplicates.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1 text-xs text-amber-900">
                    <span className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      {excelPreview.duplicates.length} Duplicate(s) Detected (Will be skipped to preserve existing data):
                    </span>
                    {excelPreview.duplicates.slice(0, 3).map((d: any, idx: number) => (
                      <p key={idx} className="text-[11px] text-amber-800 pl-5">
                        • Row {d.row_number}: {d.reason}
                      </p>
                    ))}
                    {excelPreview.duplicates.length > 3 && (
                      <p className="text-[10px] text-amber-600 pl-5 italic">
                        + {excelPreview.duplicates.length - 3} more duplicates
                      </p>
                    )}
                  </div>
                )}

                {/* New Records Table Preview */}
                {excelPreview.new_records.length > 0 ? (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Validated New Records Ready for Import ({excelPreview.new_records.length}):
                    </span>
                    <div className="border rounded-lg overflow-x-auto max-h-48 text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <tr>
                            <th className="p-2">Row</th>
                            <th className="p-2">Invoice No</th>
                            <th className="p-2">Container</th>
                            <th className="p-2">Product</th>
                            <th className="p-2 text-right">Cartons</th>
                            <th className="p-2 text-right">Net KG</th>
                            <th className="p-2 text-right">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {excelPreview.new_records.map((r: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="p-2 text-slate-400 font-mono">{r.row_number}</td>
                              <td className="p-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {r.data.invoice_no || r.data.invoice_number || "-"}
                              </td>
                              <td className="p-2 font-mono text-sky-600">
                                {r.data.container_no || r.data.container_number || "-"}
                              </td>
                              <td className="p-2">{r.data.product || r.data.product_summary || "Dry Fruits"}</td>
                              <td className="p-2 text-right">{r.data.cartons || r.data.packages || 0}</td>
                              <td className="p-2 text-right">{r.data.net_kg || r.data.net_weight_kg || 0}</td>
                              <td className="p-2 text-right font-mono">${r.data.selling_rate || r.data.rate_per_kg || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 text-center text-xs text-slate-500 rounded-lg">
                    No new valid records to import. All rows are either duplicates or empty.
                  </div>
                )}

                {/* Import Action */}
                <div className="flex items-center justify-end space-x-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setExcelPreview(null);
                      setIsExcelModalOpen(false);
                    }}
                    className="btn btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={excelImporting || excelPreview.new_records.length === 0}
                    onClick={handleConfirmExcelImport}
                    className="btn btn-primary text-xs font-bold px-5 flex items-center space-x-1.5"
                  >
                    <span>
                      {excelImporting
                        ? "Importing Records..."
                        : `Confirm Import (${excelPreview.new_records.length} Records)`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
