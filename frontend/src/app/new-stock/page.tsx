"use client";

import React, { useState, useEffect } from "react";
import {
  Boxes,
  Plus,
  ArrowRightCircle,
  Search,
  Filter,
  CheckCircle2,
  X,
  Truck,
  Ship,
} from "lucide-react";
import { fetchApi, formatUSD, formatRate, formatWeight, formatNumber } from "@/lib/api";

export default function NewStockPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [transports, setTransports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any>(null);

  // New Stock Form
  const [formData, setFormData] = useState<any>({
    stock_code: "",
    date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    customer_id: "",
    product_name: "Black Raisins",
    product_grade: "Best Quality",
    packages: 2300,
    cartons: 2300,
    package_type: "CTNS",
    net_kg: 23000,
    selling_rate: 3.25,
    purchase_rate: 2.10,
    location: "Kabul Warehouse",
    status: "READY FOR LOADING",
    notes: "",
  });

  // Conversion Form
  const [convertData, setConvertData] = useState<any>({
    invoice_number: "",
    container_number: "",
    bl_number: "",
    truck_number: "",
    transport_company_id: "",
    transport_freight: 6500,
  });

  async function loadData() {
    setLoading(true);
    try {
      const [stData, cData, supData, tData] = await Promise.all([
        fetchApi<any[]>("/new-stock"),
        fetchApi<any[]>("/customers"),
        fetchApi<any[]>("/suppliers"),
        fetchApi<any[]>("/transport-companies"),
      ]);
      setStocks(stData);
      setCustomers(cData);
      setSuppliers(supData);
      setTransports(tData);
      if (cData.length > 0 && !formData.customer_id) {
        setFormData((prev: any) => ({ ...prev, customer_id: cData[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi("/new-stock", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          customer_id: formData.customer_id ? Number(formData.customer_id) : null,
          supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
          cartons: Number(formData.cartons),
          packages: Number(formData.packages),
          net_kg: Number(formData.net_kg),
          selling_rate: Number(formData.selling_rate),
          purchase_rate: Number(formData.purchase_rate),
        }),
      });
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to save stock");
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock) return;
    try {
      const res: any = await fetchApi(`/new-stock/${selectedStock.id}/convert-to-shipment`, {
        method: "POST",
        body: JSON.stringify({
          ...convertData,
          transport_company_id: convertData.transport_company_id ? Number(convertData.transport_company_id) : null,
          transport_freight: Number(convertData.transport_freight),
        }),
      });
      alert(res.message);
      setIsConvertOpen(false);
      setSelectedStock(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to convert stock");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            New Stock Management
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Pre-shipment Preparation • Stock Lots (NEW STOCK-001) • 1-Click Shipment Conversion
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Stock Lot</span>
        </button>
      </div>

      {/* Stocks Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                <th className="p-3 pl-4 border-b border-slate-200 dark:border-slate-800">Stock ID</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-800">Date</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-800">Intended Customer</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-800">Product</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-800 text-right">Packages</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-800 text-right">Net Weight</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-800 text-right">Selling Rate</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-800 text-right text-sky-600 dark:text-sky-400">Proforma Value</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-800 text-right">Purchase Rate</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-800 text-right">Purchase Cost</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-800">Location</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-800">Status</th>
                <th className="p-3 pr-4 border-b border-slate-200 dark:border-slate-800 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400">
                    Loading stock records...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400">
                    No new stock lots recorded yet.
                  </td>
                </tr>
              ) : (
                stocks.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 pl-4 font-mono font-bold text-sky-600 dark:text-sky-400">{st.stock_code}</td>
                    <td className="p-3 text-slate-500">{st.date}</td>
                    <td className="p-3 font-semibold">{st.customer_name || "Unallocated"}</td>
                    <td className="p-3">{st.product_name} <span className="text-slate-400">({st.product_grade || ""})</span></td>
                    <td className="p-3 text-right font-mono">{formatNumber(st.packages)} {st.package_type}</td>
                    <td className="p-3 text-right font-mono">{formatWeight(st.net_kg)}</td>
                    <td className="p-3 text-right font-mono">{formatRate(st.selling_rate)}</td>
                    <td className="p-3 text-right font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50/40 dark:bg-sky-950/20">
                      {formatUSD(st.selling_value)}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-500">{formatRate(st.purchase_rate)}</td>
                    <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatUSD(st.purchase_cost)}
                    </td>
                    <td className="p-3 text-slate-500">{st.location || "Kabul"}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          st.status === "LOADED" || st.status === "SHIPPED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : st.status === "READY FOR LOADING"
                            ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {st.status}
                      </span>
                    </td>
                    <td className="p-3 pr-4 text-center">
                      {st.status !== "LOADED" && st.status !== "SHIPPED" ? (
                        <button
                          onClick={() => {
                            setSelectedStock(st);
                            setConvertData({
                              invoice_number: `INV-AQ-${st.stock_code.replace("NEW STOCK-", "")}`,
                              container_number: "",
                              bl_number: "",
                              truck_number: "",
                              transport_company_id: transports[0]?.id || "",
                              transport_freight: 6500,
                            });
                            setIsConvertOpen(true);
                          }}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 hover:bg-sky-100 font-bold text-[11px] transition-colors"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" />
                          <span>Convert to Shipment</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Converted</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Convert to Shipment Modal */}
      {isConvertOpen && selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center space-x-2">
                <Ship className="w-5 h-5 text-sky-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Convert {selectedStock.stock_code} to Real Shipment
                </h2>
              </div>
              <button onClick={() => setIsConvertOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConvert} className="p-6 space-y-4">
              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl text-xs space-y-1">
                <div className="font-bold text-sky-900 dark:text-sky-100">{selectedStock.product_name} ({formatWeight(selectedStock.net_kg)})</div>
                <div className="text-slate-600 dark:text-slate-400">Buyer: {selectedStock.customer_name} • Value: {formatUSD(selectedStock.selling_value)}</div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Invoice Number *</label>
                <input
                  type="text"
                  required
                  value={convertData.invoice_number}
                  onChange={(e) => setConvertData({ ...convertData, invoice_number: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Container Number</label>
                  <input
                    type="text"
                    value={convertData.container_number}
                    onChange={(e) => setConvertData({ ...convertData, container_number: e.target.value })}
                    placeholder="MSCU1234567"
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">BL Number</label>
                  <input
                    type="text"
                    value={convertData.bl_number}
                    onChange={(e) => setConvertData({ ...convertData, bl_number: e.target.value })}
                    placeholder="MEDU992384"
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Truck Number</label>
                  <input
                    type="text"
                    value={convertData.truck_number}
                    onChange={(e) => setConvertData({ ...convertData, truck_number: e.target.value })}
                    placeholder="AFG-KBL-..."
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Transport Freight ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={convertData.transport_freight}
                    onChange={(e) => setConvertData({ ...convertData, transport_freight: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConvertOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-xs"
                >
                  Create Shipment Without Re-Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Stock Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center space-x-2">
                <Boxes className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Create New Stock Lot</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStock} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Intended Customer (Buyer)</label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Unallocated</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Cartons / Packages *</label>
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
                    value={formData.net_kg}
                    onChange={(e) => setFormData({ ...formData, net_kg: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="NEW">NEW</option>
                    <option value="PURCHASED">PURCHASED</option>
                    <option value="PACKING">PACKING</option>
                    <option value="READY FOR LOADING">READY FOR LOADING</option>
                    <option value="ALLOCATED">ALLOCATED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Selling Rate / KG (USD)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.selling_rate}
                    onChange={(e) => setFormData({ ...formData, selling_rate: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Purchase Rate / KG (USD)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.purchase_rate}
                    onChange={(e) => setFormData({ ...formData, purchase_rate: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

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
                  Save Stock Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
