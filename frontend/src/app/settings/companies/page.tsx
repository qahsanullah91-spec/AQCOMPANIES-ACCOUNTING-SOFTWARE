"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Edit2,
  Archive,
  Download,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Globe,
  DollarSign,
  FileText,
  Phone,
  Mail,
  MapPin,
  X,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { API_BASE } from "@/lib/api";

interface Company {
  id: number;
  company_code: string;
  company_name: string;
  legal_name?: string;
  trade_license_no?: string;
  tax_number?: string;
  country: string;
  address?: string;
  phone?: string;
  email?: string;
  base_currency: string;
  color_accent: string;
  status: string;
  created_at?: string;
}

export default function CompaniesSettingsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedUserCompany, setSelectedUserCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    company_code: "",
    company_name: "",
    legal_name: "",
    trade_license_no: "",
    tax_number: "",
    country: "UAE",
    address: "",
    phone: "",
    email: "",
    base_currency: "USD",
    color_accent: "#2563eb",
    status: "ACTIVE",
  });

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await fetch("${API_BASE}/companies");
      const json = await res.json();
      if (json.status === "SUCCESS") {
        setCompanies(json.companies);
      }
    } catch (err) {
      console.error("Error fetching companies:", err);
      setMsg({ type: "error", text: "Failed to load companies." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleOpenCreate = () => {
    setEditingCompany(null);
    setFormData({
      company_code: "",
      company_name: "",
      legal_name: "",
      trade_license_no: "",
      tax_number: "",
      country: "UAE",
      address: "",
      phone: "",
      email: "",
      base_currency: "USD",
      color_accent: "#2563eb",
      status: "ACTIVE",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (comp: Company) => {
    setEditingCompany(comp);
    setFormData({
      company_code: comp.company_code,
      company_name: comp.company_name,
      legal_name: comp.legal_name || comp.company_name,
      trade_license_no: comp.trade_license_no || "",
      tax_number: comp.tax_number || "",
      country: comp.country || "UAE",
      address: comp.address || "",
      phone: comp.phone || "",
      email: comp.email || "",
      base_currency: comp.base_currency || "USD",
      color_accent: comp.color_accent || "#2563eb",
      status: comp.status || "ACTIVE",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const url = editingCompany
        ? `${API_BASE}/companies/${editingCompany.id}`
        : "${API_BASE}/companies";
      const method = editingCompany ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.detail || "Operation failed.");
      }

      setMsg({
        type: "success",
        text: editingCompany
          ? `Company "${formData.company_name}" updated successfully.`
          : `Company "${formData.company_name}" registered successfully.`,
      });
      setShowModal(false);
      fetchCompanies();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to save company." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (comp: Company) => {
    if (comp.id === 1) {
      alert("Primary legal entity AQ COMPANIES cannot be archived.");
      return;
    }
    if (!confirm(`Are you sure you want to archive "${comp.company_name}"? Historical books and journals will remain intact.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/companies/${comp.id}/archive`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Archive failed.");
      setMsg({ type: "success", text: `Company "${comp.company_name}" has been archived.` });
      fetchCompanies();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to archive company." });
    }
  };

  const handleViewUsers = async (comp: Company) => {
    setSelectedUserCompany(comp);
    setUserModalOpen(true);
    try {
      const res = await fetch(`${API_BASE}/companies/${comp.id}/users`);
      const json = await res.json();
      setCompanyUsers(json.users || []);
    } catch (err) {
      console.error("Error fetching company users:", err);
    }
  };

  const handleExportData = async (comp: Company) => {
    try {
      const res = await fetch(`${API_BASE}/companies/${comp.id}/export`);
      const json = await res.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Company_${comp.company_code}_Data_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed.");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AccountingNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  Legal Entities & Company Setup
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                  {companies.length} Registered
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage group subsidiaries, trade licenses, tax profiles, and user permissions across AQ COMPANIES
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchCompanies}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-1 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Entity</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {msg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            msg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center space-x-2">
            {msg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Entities Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        {companies.map((comp) => (
          <div
            key={comp.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition relative flex flex-col justify-between"
            style={{ borderLeft: `6px solid ${comp.color_accent || "#2563eb"}` }}
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {comp.company_code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        comp.status === "ACTIVE"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {comp.status}
                    </span>
                    {comp.id === 1 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                        Primary HQ
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                    {comp.company_name}
                  </h3>
                  <div className="text-xs text-slate-500 italic mt-0.5">
                    {comp.legal_name || comp.company_name}
                  </div>
                </div>

                <div
                  className="w-4 h-4 rounded-full border border-slate-300 shadow-inner shrink-0"
                  style={{ backgroundColor: comp.color_accent }}
                  title={`Brand Accent: ${comp.color_accent}`}
                />
              </div>

              {/* Details List */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Country:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{comp.country}</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Base Currency:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{comp.base_currency}</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Trade License:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{comp.trade_license_no || "N/A"}</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Tax Reg / TRN:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{comp.tax_number || "N/A"}</span>
                </div>
              </div>

              {/* Address & Contact */}
              {(comp.address || comp.phone || comp.email) && (
                <div className="mt-3 text-[11px] text-slate-500 space-y-1 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  {comp.address && (
                    <div className="flex items-start space-x-1.5">
                      <MapPin className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                      <span>{comp.address}</span>
                    </div>
                  )}
                  {comp.phone && (
                    <div className="flex items-center space-x-1.5">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{comp.phone}</span>
                    </div>
                  )}
                  {comp.email && (
                    <div className="flex items-center space-x-1.5">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{comp.email}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions Bar */}
            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => handleViewUsers(comp)}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-semibold transition"
                  title="View Authorized Users"
                >
                  <Users className="w-3 h-3" />
                  <span>Permissions</span>
                </button>

                <button
                  onClick={() => handleExportData(comp)}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-semibold transition"
                  title="Export Entity Data JSON"
                >
                  <Download className="w-3 h-3" />
                  <span>Export</span>
                </button>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => handleOpenEdit(comp)}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-md font-semibold hover:bg-purple-100 transition"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>

                {comp.id !== 1 && comp.status === "ACTIVE" && (
                  <button
                    onClick={() => handleArchive(comp)}
                    className="flex items-center space-x-1 px-2.5 py-1 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-md font-semibold hover:bg-rose-100 transition"
                    title="Archive Legal Entity"
                  >
                    <Archive className="w-3 h-3" />
                    <span>Archive</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create or Edit Entity */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {editingCompany ? `Edit Entity: ${editingCompany.company_name}` : "Register New Legal Entity"}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Company Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingCompany}
                    value={formData.company_code}
                    onChange={(e) => setFormData({ ...formData, company_code: e.target.value.toUpperCase() })}
                    placeholder="e.g. NA-LTD"
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                  />
                  <span className="text-[10px] text-slate-400">Unique group entity identifier</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Brand Color Accent
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={formData.color_accent}
                      onChange={(e) => setFormData({ ...formData, color_accent: e.target.value })}
                      className="w-9 h-8 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color_accent}
                      onChange={(e) => setFormData({ ...formData, color_accent: e.target.value })}
                      className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Company Name (Trading / Display) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="e.g. NAJEB AMIN LTD"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Legal / Registered Entity Name
                </label>
                <input
                  type="text"
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  placeholder="e.g. Najeb Amin General Trading LLC"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="e.g. UAE, Afghanistan, Uzbekistan"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Base Currency
                  </label>
                  <select
                    value={formData.base_currency}
                    onChange={(e) => setFormData({ ...formData, base_currency: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="AFN">AFN (؋)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Trade License No.
                  </label>
                  <input
                    type="text"
                    value={formData.trade_license_no}
                    onChange={(e) => setFormData({ ...formData, trade_license_no: e.target.value })}
                    placeholder="e.g. TL-782914-DXB"
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tax / TRN Number
                  </label>
                  <input
                    type="text"
                    value={formData.tax_number}
                    onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                    placeholder="e.g. 100234567800003"
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Registered Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Office 402, Al Ras Commercial Center, Deira, Dubai"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+971 4 123 4567"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Finance / Accounting Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="accounts@najebamin.com"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? "Saving Entity..." : editingCompany ? "Save Changes" : "Register Entity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Assigned Users & Permissions */}
      {userModalOpen && selectedUserCompany && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Entity Access Permissions: {selectedUserCompany.company_name}
                </h3>
              </div>
              <button
                onClick={() => setUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-500">
                The following users possess explicit operational access privileges to post journals, view bank accounts, and approve entries in this entity:
              </div>

              {companyUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No explicit user permissions configured. Global Admins retain full access.
                </div>
              ) : (
                <div className="space-y-2 font-mono text-xs">
                  {companyUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white font-sans">
                          {u.full_name} ({u.username})
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Role: {u.role} • Global: {u.user_role}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 text-[10px]">
                        {u.can_view && <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700">View</span>}
                        {u.can_post && <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700">Post</span>}
                        {u.can_approve && <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700">Approve</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
