"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Search,
  Download,
  Printer,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Info,
} from "lucide-react";
import { fetchApi, formatUSD, formatRate, formatWeight, formatNumber, API_BASE } from "@/lib/api";

interface InvoiceItem {
  id?: number;
  product_name: string;
  product_grade?: string;
  hs_code?: string;
  packages: number;
  package_type: string;
  net_weight_kg: number;
  gross_weight_kg: number;
  rate: number;
  amount?: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_type: string;
  date: string;
  customer_id: number;
  customer_name?: string;
  exporter: string;
  total_packages: number;
  total_net_kg: number;
  total_gross_kg: number;
  total_amount: number;
  amount_received: number;
  balance_due: number;
  payment_status: string;
  payment_terms: string;
  bank_details: string;
  notes?: string;
  items?: InvoiceItem[];
}

interface Customer {
  id: number;
  customer_name: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formHeader, setFormHeader] = useState({
    invoice_number: "",
    invoice_type: "COMMERCIAL",
    date: new Date().toISOString().split("T")[0],
    customer_id: "",
    exporter: "AQ COMPANIES",
    payment_terms: "100% Advance Payment / Third Party Payments Acceptable",
    bank_details: "Emirates NBD Dubai - Account: AE440260000123456789012, SWIFT: EBILAEADXXX",
    notes: "",
  });

  const [formItems, setFormItems] = useState<InvoiceItem[]>([
    {
      product_name: "Afghan Dried Figs (Injeer)",
      product_grade: "Grade AAA Jumbo",
      hs_code: "0804.20.00",
      packages: 800,
      package_type: "CTNS",
      net_weight_kg: 8000,
      gross_weight_kg: 8400,
      rate: 8.50,
    },
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invData, custData] = await Promise.all([
        fetchApi<Invoice[]>("/invoices"),
        fetchApi<Customer[]>("/customers"),
      ]);
      setInvoices(invData || []);
      setCustomers(custData || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddItem = () => {
    setFormItems([
      ...formItems,
      {
        product_name: "Black Raisins (Kishmish)",
        product_grade: "Grade A",
        hs_code: "0806.20.10",
        packages: 500,
        package_type: "CTNS",
        net_weight_kg: 5000,
        gross_weight_kg: 5250,
        rate: 3.50,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormItems(newItems);
  };

  const totalCalculatedAmount = formItems.reduce(
    (sum, it) => sum + Number(it.net_weight_kg || 0) * Number(it.rate || 0),
    0
  );
  const totalCalculatedPackages = formItems.reduce((sum, it) => sum + Number(it.packages || 0), 0);
  const totalCalculatedNetKg = formItems.reduce((sum, it) => sum + Number(it.net_weight_kg || 0), 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHeader.customer_id) {
      setErrorMsg("Please select an importer / customer");
      return;
    }
    if (!formHeader.invoice_number) {
      setErrorMsg("Please enter an invoice number");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg("");
      await fetchApi("/invoices", {
        method: "POST",
        body: JSON.stringify({
          ...formHeader,
          customer_id: Number(formHeader.customer_id),
          items: formItems.map((it) => ({
            ...it,
            packages: Number(it.packages),
            net_weight_kg: Number(it.net_weight_kg),
            gross_weight_kg: Number(it.gross_weight_kg),
            rate: Number(it.rate),
          })),
        }),
      });
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      (inv.invoice_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.customer_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "ALL" || inv.invoice_type === typeFilter;
    const matchesStatus = statusFilter === "ALL" || inv.payment_status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalSales = invoices.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
  const totalReceived = invoices.reduce((acc, i) => acc + Number(i.amount_received || 0), 0);
  const totalReceivable = invoices.reduce((acc, i) => acc + Number(i.balance_due || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-indigo-600" />
            Invoice Management
          </h1>
          <p className="text-sm text-slate-500">
            Commercial & Proforma Invoices • Multi-Product Line Items • Official PDF Export
          </p>
        </div>

        <button
          onClick={() => {
            const nextInvNum = `INV-AQ-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, "0")}`;
            setFormHeader({ ...formHeader, invoice_number: nextInvNum });
            setIsModalOpen(true);
          }}
          className="btn btn-primary flex items-center gap-2 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          Create New Invoice
        </button>
      </div>

      {/* Accounting Compliance Rule Banner */}
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900">
          <p className="font-semibold">Core Accounting Integrity Rule:</p>
          <p className="mt-0.5 text-indigo-800">
            Payment terms stating <b>&quot;100% Advance Payment&quot;</b> are contract terms, NOT proof of receipt.
            An invoice remains <b>UNPAID</b> until verified customer funds are received in the Bank Ledger and
            allocated. Bank payments never create duplicate sales revenue.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 bg-white border-l-4 border-l-indigo-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Invoiced Sales</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{formatUSD(totalSales)}</p>
          <p className="text-xs text-slate-500 mt-1">{invoices.length} Invoices Issued</p>
        </div>
        <div className="card p-5 bg-white border-l-4 border-l-emerald-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payments Collected</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{formatUSD(totalReceived)}</p>
          <p className="text-xs text-slate-500 mt-1">Direct Bank Wire / TT</p>
        </div>
        <div className="card p-5 bg-white border-l-4 border-l-rose-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding Receivables</p>
          <p className="text-2xl font-extrabold text-rose-600 mt-1">{formatUSD(totalReceivable)}</p>
          <p className="text-xs text-slate-500 mt-1">Pending Customer Collection</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice number, buyer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-sm w-full"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="select text-sm"
          >
            <option value="ALL">All Types</option>
            <option value="COMMERCIAL">Commercial Invoice</option>
            <option value="PROFORMA">Proforma Invoice</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY PAID">Partially Paid</option>
            <option value="UNPAID">Unpaid</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card overflow-hidden bg-white shadow-sm">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice # / Date</th>
                <th>Type</th>
                <th>Buyer / Importer</th>
                <th className="text-right">Packages</th>
                <th className="text-right">Net Weight</th>
                <th className="text-right">Invoice Value</th>
                <th className="text-right">Amount Received</th>
                <th className="text-right">Balance Due</th>
                <th>Payment Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">
                    Loading invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="font-semibold text-slate-900">
                      <div>{inv.invoice_number}</div>
                      <div className="text-xs text-slate-400 font-normal">{inv.date}</div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          inv.invoice_type === "COMMERCIAL" ? "badge-primary" : "badge-neutral"
                        } text-xs`}
                      >
                        {inv.invoice_type}
                      </span>
                    </td>
                    <td className="font-medium text-slate-800">
                      {inv.customer_name || `Customer #${inv.customer_id}`}
                    </td>
                    <td className="text-right font-medium">{formatNumber(inv.total_packages)} CTNS</td>
                    <td className="text-right font-medium text-slate-700">{formatWeight(inv.total_net_kg)}</td>
                    <td className="text-right font-bold text-slate-900">{formatUSD(inv.total_amount)}</td>
                    <td className="text-right font-medium text-emerald-600">{formatUSD(inv.amount_received)}</td>
                    <td className="text-right font-bold text-rose-600">{formatUSD(inv.balance_due)}</td>
                    <td>
                      {inv.payment_status === "PAID" ? (
                        <span className="badge badge-success text-xs flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Paid
                        </span>
                      ) : inv.payment_status === "PARTIALLY PAID" ? (
                        <span className="badge badge-warning text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Partial
                        </span>
                      ) : (
                        <span className="badge badge-danger text-xs flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Unpaid
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <a
                        href={`${API_BASE}/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1.5 font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                        title="Download Official PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Official Invoice</h3>
                <p className="text-xs text-slate-500">
                  Generate Commercial or Proforma Invoice for dry fruit export
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Invoice Number *</label>
                  <input
                    type="text"
                    className="input text-sm w-full font-mono font-bold"
                    value={formHeader.invoice_number}
                    onChange={(e) => setFormHeader({ ...formHeader, invoice_number: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Invoice Type</label>
                  <select
                    className="select text-sm w-full font-semibold"
                    value={formHeader.invoice_type}
                    onChange={(e) => setFormHeader({ ...formHeader, invoice_type: e.target.value })}
                  >
                    <option value="COMMERCIAL">Commercial Invoice</option>
                    <option value="PROFORMA">Proforma Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="label">Invoice Date *</label>
                  <input
                    type="date"
                    className="input text-sm w-full"
                    value={formHeader.date}
                    onChange={(e) => setFormHeader({ ...formHeader, date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Buyer / Importer (India) *</label>
                  <select
                    className="select text-sm w-full"
                    value={formHeader.customer_id}
                    onChange={(e) => setFormHeader({ ...formHeader, customer_id: e.target.value })}
                    required
                  >
                    <option value="">Select Buyer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Exporter Name</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    value={formHeader.exporter}
                    onChange={(e) => setFormHeader({ ...formHeader, exporter: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Payment Terms</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    value={formHeader.payment_terms}
                    onChange={(e) => setFormHeader({ ...formHeader, payment_terms: e.target.value })}
                  />
                </div>
              </div>

              {/* Items Table Section */}
              <div className="border rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Invoice Line Items (Multi-Product Support)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="btn btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product Row
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-slate-600 font-semibold">
                        <th className="text-left pb-2">Product Description</th>
                        <th className="text-left pb-2 w-24">Grade</th>
                        <th className="text-left pb-2 w-24">HS Code</th>
                        <th className="text-right pb-2 w-20">Packages</th>
                        <th className="text-right pb-2 w-24">Net KG</th>
                        <th className="text-right pb-2 w-24">Rate ($/KG)</th>
                        <th className="text-right pb-2 w-28">Amount (USD)</th>
                        <th className="text-center pb-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {formItems.map((item, idx) => {
                        const lineAmount = (item.net_weight_kg || 0) * (item.rate || 0);
                        return (
                          <tr key={idx} className="py-1">
                            <td className="pr-2 py-1.5">
                              <input
                                type="text"
                                className="input text-xs w-full"
                                value={item.product_name}
                                onChange={(e) => handleItemChange(idx, "product_name", e.target.value)}
                                placeholder="Product"
                                required
                              />
                            </td>
                            <td className="pr-2 py-1.5">
                              <input
                                type="text"
                                className="input text-xs w-full"
                                value={item.product_grade || ""}
                                onChange={(e) => handleItemChange(idx, "product_grade", e.target.value)}
                                placeholder="Grade"
                              />
                            </td>
                            <td className="pr-2 py-1.5">
                              <input
                                type="text"
                                className="input text-xs w-full"
                                value={item.hs_code || ""}
                                onChange={(e) => handleItemChange(idx, "hs_code", e.target.value)}
                                placeholder="HS Code"
                              />
                            </td>
                            <td className="pr-2 py-1.5 text-right">
                              <input
                                type="number"
                                className="input text-xs w-full text-right"
                                value={item.packages}
                                onChange={(e) => handleItemChange(idx, "packages", Number(e.target.value))}
                                required
                              />
                            </td>
                            <td className="pr-2 py-1.5 text-right">
                              <input
                                type="number"
                                step="0.001"
                                className="input text-xs w-full text-right"
                                value={item.net_weight_kg}
                                onChange={(e) => handleItemChange(idx, "net_weight_kg", Number(e.target.value))}
                                required
                              />
                            </td>
                            <td className="pr-2 py-1.5 text-right">
                              <input
                                type="number"
                                step="0.0001"
                                className="input text-xs w-full text-right"
                                value={item.rate}
                                onChange={(e) => handleItemChange(idx, "rate", Number(e.target.value))}
                                required
                              />
                            </td>
                            <td className="pr-2 py-1.5 text-right font-bold text-slate-800">
                              {formatUSD(lineAmount)}
                            </td>
                            <td className="text-center py-1.5">
                              {formItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-bold text-slate-900">
                        <td colSpan={3} className="pt-2 text-right">TOTALS:</td>
                        <td className="pt-2 text-right">{formatNumber(totalCalculatedPackages)} CTNS</td>
                        <td className="pt-2 text-right">{formatWeight(totalCalculatedNetKg)}</td>
                        <td></td>
                        <td className="pt-2 text-right text-indigo-700 text-sm">{formatUSD(totalCalculatedAmount)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div>
                <label className="label">Bank Wire / SWIFT Instructions</label>
                <input
                  type="text"
                  className="input text-sm w-full font-mono text-xs"
                  value={formHeader.bank_details}
                  onChange={(e) => setFormHeader({ ...formHeader, bank_details: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Special Instructions / Remarks</label>
                <textarea
                  rows={2}
                  className="textarea text-sm w-full"
                  value={formHeader.notes}
                  onChange={(e) => setFormHeader({ ...formHeader, notes: e.target.value })}
                  placeholder="Third party payments acceptable, delivery address, port of discharge..."
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
                  {submitting ? "Generating..." : "Generate & Save Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
