"use client";

import React, { useEffect, useState } from "react";
import {
  Navigation,
  Plus,
  Search,
  Building,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Truck,
  Box,
  FileText,
  Info,
} from "lucide-react";
import { fetchApi, formatUSD, formatRate, formatNumber } from "@/lib/api";

interface TransportCompany {
  id: number;
  company_name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  country?: string;
  notes?: string;
}

interface TransportSummary {
  total_transport_charges: number;
  total_paid: number;
  outstanding_balance: number;
  credit_balance: number;
  has_credit_with_transport_company: boolean;
  credit_display: string | null;
  total_containers: number;
  average_freight_per_container: number;
}

interface TransportLedgerEntry {
  date: string;
  shipment: string;
  invoice?: string;
  customer?: string;
  container?: string;
  bl?: string;
  product?: string;
  transport_charge: number;
  payment: number;
  balance?: number;
  notes?: string;
}

interface TransportDetailResponse {
  profile: TransportCompany;
  summary: TransportSummary;
  ledger: TransportLedgerEntry[];
}

export default function TransportPage() {
  const [companies, setCompanies] = useState<TransportCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [companyDetail, setCompanyDetail] = useState<TransportDetailResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    company_name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "Karachi Port / Kabul Logistics Hub",
    country: "Pakistan / Afghanistan",
    notes: "",
  });

  const loadCompanies = async () => {
    try {
      setLoadingList(true);
      const data = await fetchApi<TransportCompany[]>("/transport-companies");
      setCompanies(data || []);
      if (data && data.length > 0 && !selectedCompanyId) {
        setSelectedCompanyId(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  const loadCompanyDetail = async (id: number) => {
    try {
      setLoadingDetail(true);
      const detail = await fetchApi<TransportDetailResponse>(`/transport-companies/${id}/ledger`);
      setCompanyDetail(detail);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      loadCompanyDetail(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg("");
      const created = await fetchApi<TransportCompany>("/transport-companies", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      setFormData({
        company_name: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "Karachi Port / Kabul Logistics Hub",
        country: "Pakistan / Afghanistan",
        notes: "",
      });
      await loadCompanies();
      if (created?.id) setSelectedCompanyId(created.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create transport company");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCompanies = companies.filter(
    (c) =>
      c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_person || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Navigation className="w-7 h-7 text-sky-600" />
            Transport & Logistics Ledger
          </h1>
          <p className="text-sm text-slate-500">
            Logistics Service Providers • Container Freight Charges • Advance Payments & Credits
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary flex items-center gap-2 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          Add Transport Company
        </button>
      </div>

      {/* Critical Business Rule Banner */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-950">
          <p className="font-bold">Fundamental Logistics Rule:</p>
          <p className="mt-0.5 text-sky-800">
            The transport company is <b>ONLY a logistics service provider</b>. They do not own the cargo and do not sell
            to Indian customers. Payments made to them reduce our transport payable — if payments exceed billed freight,
            the excess is <b>OUR CREDIT / Transport Company Owes Us</b>, not extra expense.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Transport Company Directory */}
        <div className="lg:col-span-4 space-y-4">
          <div className="card p-3 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search transport companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 text-xs w-full"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[700px] overflow-y-auto">
            {loadingList ? (
              <div className="card p-6 text-center text-slate-400 text-xs">Loading companies...</div>
            ) : filteredCompanies.length === 0 ? (
              <div className="card p-6 text-center text-slate-400 text-xs">No transport companies found</div>
            ) : (
              filteredCompanies.map((tc) => {
                const isSelected = tc.id === selectedCompanyId;
                return (
                  <div
                    key={tc.id}
                    onClick={() => setSelectedCompanyId(tc.id)}
                    className={`card p-4 cursor-pointer transition-all border ${
                      isSelected
                        ? "border-sky-600 bg-sky-50/40 shadow-sm ring-1 ring-sky-500"
                        : "hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-sm">{tc.company_name}</div>
                      <ChevronRight
                        className={`w-4 h-4 ${isSelected ? "text-sky-600" : "text-slate-400"}`}
                      />
                    </div>
                    {tc.contact_person && (
                      <div className="text-xs text-slate-600 mt-0.5">{tc.contact_person}</div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 font-mono">
                      {tc.phone && <span>{tc.phone}</span>}
                      {tc.country && <span>{tc.country}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Ledger & Balances */}
        <div className="lg:col-span-8 space-y-6">
          {loadingDetail || !companyDetail ? (
            <div className="card p-12 text-center text-slate-400">Loading transport company ledger...</div>
          ) : (
            <>
              {/* Special Prominent Balance Banner */}
              {companyDetail.summary.has_credit_with_transport_company ? (
                <div className="card p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-extrabold tracking-widest bg-emerald-800/60 px-2.5 py-1 rounded">
                      ★ Advance Payment Surplus / Credit in Our Favor
                    </span>
                    <span className="text-xs font-semibold opacity-90">
                      Overbilled or Advanced Funds
                    </span>
                  </div>
                  <div className="text-3xl font-black tracking-tight">
                    {companyDetail.summary.credit_display}
                  </div>
                  <p className="text-xs text-emerald-100">
                    We have paid ${formatUSD(companyDetail.summary.total_paid).replace("$", "")} against total billed
                    charges of ${formatUSD(companyDetail.summary.total_transport_charges).replace("$", "")}.
                    This credit will automatically offset future container freight charges.
                  </p>
                </div>
              ) : companyDetail.summary.outstanding_balance > 0 ? (
                <div className="card p-5 bg-gradient-to-r from-rose-600 to-amber-700 text-white shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-extrabold tracking-widest bg-rose-800/60 px-2.5 py-1 rounded">
                      Outstanding Freight Payable
                    </span>
                    <span className="text-xs font-semibold opacity-90">
                      Payment Due to Carrier
                    </span>
                  </div>
                  <div className="text-3xl font-black tracking-tight">
                    Payable: {formatUSD(companyDetail.summary.outstanding_balance)}
                  </div>
                  <p className="text-xs text-rose-100">
                    Total freight charged: {formatUSD(companyDetail.summary.total_transport_charges)} | Total paid to date:{" "}
                    {formatUSD(companyDetail.summary.total_paid)}.
                  </p>
                </div>
              ) : (
                <div className="card p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
                  <span className="font-bold text-sm flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" /> All Transport Accounts Fully Settled ($0.00 Balance)
                  </span>
                </div>
              )}

              {/* Profile & KPI Summary */}
              <div className="card p-6 bg-white shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b pb-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {companyDetail.profile.company_name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                      {companyDetail.profile.contact_person && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5" />
                          {companyDetail.profile.contact_person}
                        </span>
                      )}
                      {companyDetail.profile.phone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5" />
                          {companyDetail.profile.phone}
                        </span>
                      )}
                      {companyDetail.profile.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {companyDetail.profile.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[11px] text-slate-600 font-semibold block">Total Freight Charges</span>
                    <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                      {formatUSD(companyDetail.summary.total_transport_charges)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {companyDetail.summary.total_containers} Containers Handled
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <span className="text-[11px] text-emerald-700 font-semibold block">Total Payments Sent</span>
                    <span className="text-lg font-bold text-emerald-900 mt-0.5 block">
                      {formatUSD(companyDetail.summary.total_paid)}
                    </span>
                    <span className="text-[10px] text-emerald-600">Wire / Sarafi Transfers</span>
                  </div>

                  <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg">
                    <span className="text-[11px] text-sky-700 font-semibold block">Avg Freight / Container</span>
                    <span className="text-lg font-bold text-sky-900 mt-0.5 block">
                      {formatUSD(companyDetail.summary.average_freight_per_container)}
                    </span>
                    <span className="text-[10px] text-sky-600">Average Contract Rate</span>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <span className="text-[11px] text-amber-700 font-semibold block">Account Status</span>
                    <span className="text-base font-bold text-amber-950 mt-1 block">
                      {companyDetail.summary.has_credit_with_transport_company
                        ? "Credit Balance"
                        : companyDetail.summary.outstanding_balance > 0
                        ? "Payable Balance"
                        : "Balanced"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Running Ledger Table */}
              <div className="card overflow-hidden bg-white shadow-sm space-y-3">
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Transport Account Running Ledger
                    </h3>
                    <p className="text-xs text-slate-500">
                      Container freight charges increase payable; bank payments reduce payable
                    </p>
                  </div>
                </div>

                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Shipment / Container</th>
                        <th>B/L & Invoice</th>
                        <th>Cargo Details</th>
                        <th className="text-right">Freight Charge</th>
                        <th className="text-right">Paid to Carrier</th>
                        <th className="text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyDetail.ledger.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400">
                            No ledger entries recorded yet for this carrier.
                          </td>
                        </tr>
                      ) : (
                        companyDetail.ledger.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="text-xs text-slate-600 font-mono font-medium">{entry.date}</td>
                            <td className="font-semibold text-slate-900">
                              <div>{entry.shipment}</div>
                              {entry.container && (
                                <div className="text-xs text-sky-600 font-mono font-normal">
                                  {entry.container}
                                </div>
                              )}
                            </td>
                            <td className="text-xs text-slate-700">
                              {entry.bl && <div>BL: {entry.bl}</div>}
                              {entry.invoice && <div>Inv: {entry.invoice}</div>}
                            </td>
                            <td className="text-slate-700 text-xs">
                              <div>{entry.product || "Dry Fruit Cargo"}</div>
                              {entry.customer && <div className="text-slate-400">{entry.customer}</div>}
                            </td>
                            <td className="text-right font-medium text-slate-900">
                              {entry.transport_charge > 0 ? (
                                <span className="font-bold text-slate-900">{formatUSD(entry.transport_charge)}</span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="text-right font-medium text-emerald-600">
                              {entry.payment > 0 ? (
                                <span className="font-bold text-emerald-700">{formatUSD(entry.payment)}</span>
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
                                    ? "text-emerald-600 font-black"
                                    : "text-slate-600"
                                }
                              >
                                {(entry.balance || 0) < 0
                                  ? `(Credit: ${formatUSD(Math.abs(entry.balance || 0))})`
                                  : formatUSD(entry.balance || 0)}
                              </span>
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

      {/* Add Transport Company Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add Transport Company</h3>
                <p className="text-xs text-slate-500">
                  Register shipping line or freight forwarding service provider
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
                  <label className="label">Transport / Freight Forwarding Company Name *</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="e.g. Silk Route Logistics Kabul / Karachi"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Contact Person</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="e.g. Bilal Khan (Operations Manager)"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Phone / WhatsApp</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="+92 300 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    className="input text-sm w-full"
                    placeholder="operations@silkroutelogistics.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Operating Corridor / Country</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="Afghanistan - Pakistan - India"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label">Office Address / Port Office</label>
                  <input
                    type="text"
                    className="input text-sm w-full"
                    placeholder="Port Qasim / Karachi Marine Hub"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Notes / Booking Procedures</label>
                <textarea
                  rows={2}
                  className="textarea text-sm w-full"
                  placeholder="Standard demurrage rules, payment schedule, container types..."
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
                  {submitting ? "Saving..." : "Save Transport Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
