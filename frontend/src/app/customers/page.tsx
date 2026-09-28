"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Search,
  Building,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { fetchApi, formatUSD, formatRate, formatWeight, formatNumber } from "@/lib/api";

interface CustomerProfile {
  id: number;
  customer_name: string;
  contact_person?: string;
  address?: string;
  country?: string;
  phone?: string;
  email?: string;
  iec?: string;
  gst?: string;
  pan?: string;
  fssai?: string;
  other_registration?: string;
  notes?: string;
}

interface CustomerSummary {
  total_invoices: number;
  total_sales: number;
  total_paid: number;
  total_outstanding: number;
  total_containers: number;
  total_kg: number;
  total_profit: number;
  average_sale_rate: number;
}

interface LedgerEntry {
  date: string;
  invoice?: string;
  shipment?: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  payment_reference?: string;
  bank?: string;
  notes?: string;
}

interface CustomerDetailResponse {
  profile: CustomerProfile;
  summary: CustomerSummary;
  ledger: LedgerEntry[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetailResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    customer_name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "Khari Baoli, Delhi, India",
    country: "India",
    iec: "",
    gst: "",
    pan: "",
    fssai: "",
    notes: "",
  });

  const loadCustomers = async () => {
    try {
      setLoadingList(true);
      const data = await fetchApi<CustomerProfile[]>("/customers");
      setCustomers(data || []);
      if (data && data.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  const loadCustomerDetail = async (id: number) => {
    try {
      setLoadingDetail(true);
      const detail = await fetchApi<CustomerDetailResponse>(`/customers/${id}/ledger`);
      setCustomerDetail(detail);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerDetail(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg("");
      const created = await fetchApi<CustomerProfile>("/customers", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      setFormData({
        customer_name: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "Khari Baoli, Delhi, India",
        country: "India",
        iec: "",
        gst: "",
        pan: "",
        fssai: "",
        notes: "",
      });
      await loadCustomers();
      if (created?.id) setSelectedCustomerId(created.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create customer");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_person || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.gst || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Customer Accounts & Running Ledger
          </h1>
          <p className="text-sm text-slate-500">
            Indian Buyers • Regulatory Compliance (IEC/GST/PAN/FSSAI) • Running Debit/Credit Ledger
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary flex items-center gap-2 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Customer Directory */}
        <div className="lg:col-span-4 space-y-4">
          <div className="card p-3 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search customers, GST, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 text-xs w-full"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[700px] overflow-y-auto">
            {loadingList ? (
              <div className="card p-6 text-center text-slate-400 text-xs">Loading customers...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="card p-6 text-center text-slate-400 text-xs">No customers found</div>
            ) : (
              filteredCustomers.map((cust) => {
                const isSelected = cust.id === selectedCustomerId;
                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`card p-4 cursor-pointer transition-all border ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-500"
                        : "hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-sm">{cust.customer_name}</div>
                      <ChevronRight
                        className={`w-4 h-4 ${isSelected ? "text-indigo-600" : "text-slate-400"}`}
                      />
                    </div>
                    {cust.contact_person && (
                      <div className="text-xs text-slate-600 mt-0.5">{cust.contact_person}</div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 font-mono">
                      {cust.phone && <span>{cust.phone}</span>}
                      {cust.gst && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">GST: {cust.gst}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Customer Details & Running Ledger */}
        <div className="lg:col-span-8 space-y-6">
          {loadingDetail || !customerDetail ? (
            <div className="card p-12 text-center text-slate-400">Loading customer account details...</div>
          ) : (
            <>
              {/* Profile Card */}
              <div className="card p-6 bg-white shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b pb-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {customerDetail.profile.customer_name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                      {customerDetail.profile.contact_person && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {customerDetail.profile.contact_person}
                        </span>
                      )}
                      {customerDetail.profile.phone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5" />
                          {customerDetail.profile.phone}
                        </span>
                      )}
                      {customerDetail.profile.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {customerDetail.profile.email}
                        </span>
                      )}
                      {customerDetail.profile.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {customerDetail.profile.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="badge badge-success px-3 py-1 font-semibold text-xs flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Active Trading Partner
                  </span>
                </div>

                {/* Regulatory Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">IEC Code</span>
                    <span className="font-bold text-slate-800">{customerDetail.profile.iec || "N/A"}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">GST Number</span>
                    <span className="font-bold text-slate-800">{customerDetail.profile.gst || "N/A"}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">PAN Number</span>
                    <span className="font-bold text-slate-800">{customerDetail.profile.pan || "N/A"}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">FSSAI License</span>
                    <span className="font-bold text-slate-800">{customerDetail.profile.fssai || "N/A"}</span>
                  </div>
                </div>

                {/* Financial KPI Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                    <span className="text-[11px] text-indigo-700 font-semibold block">Total Invoiced Sales</span>
                    <span className="text-lg font-bold text-indigo-900 mt-0.5 block">
                      {formatUSD(customerDetail.summary.total_sales)}
                    </span>
                    <span className="text-[10px] text-indigo-600 font-medium">
                      {customerDetail.summary.total_invoices} Invoices Issued
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <span className="text-[11px] text-emerald-700 font-semibold block">Total Payments Received</span>
                    <span className="text-lg font-bold text-emerald-900 mt-0.5 block">
                      {formatUSD(customerDetail.summary.total_paid)}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium">Bank Wire / TT</span>
                  </div>

                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                    <span className="text-[11px] text-rose-700 font-semibold block">Current Receivable Due</span>
                    <span className="text-lg font-bold text-rose-900 mt-0.5 block">
                      {formatUSD(customerDetail.summary.total_outstanding)}
                    </span>
                    <span className="text-[10px] text-rose-600 font-medium">Outstanding Customer Balance</span>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <span className="text-[11px] text-amber-700 font-semibold block">Total Trade Volume</span>
                    <span className="text-lg font-bold text-amber-900 mt-0.5 block">
                      {formatWeight(customerDetail.summary.total_kg)}
                    </span>
                    <span className="text-[10px] text-amber-600 font-medium">
                      Avg Rate: {formatRate(customerDetail.summary.average_sale_rate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Running Debit/Credit Ledger */}
              <div className="card overflow-hidden bg-white shadow-sm space-y-3">
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Statement of Account & Running Ledger
                    </h3>
                    <p className="text-xs text-slate-500">
                      Chronological journal: Debit = Invoiced Sales, Credit = Bank Wire Receipts
                    </p>
                  </div>
                </div>

                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference / Doc</th>
                        <th>Description</th>
                        <th className="text-right">Debit (Sales)</th>
                        <th className="text-right">Credit (Receipts)</th>
                        <th className="text-right">Running Balance</th>
                        <th>Settlement Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerDetail.ledger.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400">
                            No ledger transactions recorded yet for this customer.
                          </td>
                        </tr>
                      ) : (
                        customerDetail.ledger.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="text-xs text-slate-600 font-mono font-medium">{entry.date}</td>
                            <td className="font-semibold text-slate-900">
                              <div>{entry.invoice || entry.shipment || "Direct"}</div>
                            </td>
                            <td className="text-slate-700 text-xs">{entry.description}</td>
                            <td className="text-right font-medium text-slate-900">
                              {entry.debit > 0 ? (
                                <span className="text-indigo-700 font-bold">{formatUSD(entry.debit)}</span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="text-right font-medium text-emerald-600">
                              {entry.credit > 0 ? (
                                <span className="text-emerald-700 font-bold">{formatUSD(entry.credit)}</span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="text-right font-extrabold text-slate-900">
                              <span
                                className={
                                  entry.balance > 0
                                    ? "text-rose-600"
                                    : entry.balance < 0
                                    ? "text-emerald-600"
                                    : "text-slate-600"
                                }
                              >
                                {formatUSD(entry.balance)}
                              </span>
                            </td>
                            <td className="text-xs text-slate-500">
                              {entry.bank && <div>Bank: {entry.bank}</div>}
                              {entry.payment_reference && <div>Ref: {entry.payment_reference}</div>}
                              {entry.notes && <div className="text-[11px] text-slate-400 italic">{entry.notes}</div>}
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

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add New Customer / Buyer</h3>
                <p className="text-xs text-slate-500">Enter Indian buyer account and regulatory details</p>
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
                  <label className="label">Customer / Company Name *</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="e.g. Royal Dry Fruits Mumbai Pvt Ltd"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Contact Person</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="e.g. Rajesh Kumar"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Phone / WhatsApp *</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="+91 98200 12345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    className="input text-sm w-full"
                    placeholder="rajesh@royaldryfruits.in"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Address / Market</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="APMC Market, Vashi, Navi Mumbai"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">IEC (Import Export Code)</label>
                  <input
                    type="text"
                    className="input text-sm w-full font-mono"
                    placeholder="e.g. 0308012345"
                    value={formData.iec}
                    onChange={(e) => setFormData({ ...formData, iec: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">GST Number</label>
                  <input
                    type="text"
                    className="input text-sm w-full font-mono"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    value={formData.gst}
                    onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">PAN Number</label>
                  <input
                    type="text"
                    className="input text-sm w-full font-mono"
                    placeholder="e.g. AABCR1234F"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">FSSAI License Number</label>
                  <input
                    type="text"
                    className="input text-sm w-full font-mono"
                    placeholder="e.g. 10019011000123"
                    value={formData.fssai}
                    onChange={(e) => setFormData({ ...formData, fssai: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Notes / Payment Terms</label>
                <textarea
                  rows={2}
                  className="textarea text-sm w-full"
                  placeholder="Payment arrangements, banking terms..."
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
                  {submitting ? "Saving..." : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
