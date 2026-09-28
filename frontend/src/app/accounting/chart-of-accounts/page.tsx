"use client";

import React, { useState, useEffect } from "react";
import {
  ListTree,
  Plus,
  Edit2,
  Check,
  X,
  Search,
  CheckCircle2,
  FolderTree,
} from "lucide-react";
import { fetchApi, formatUSD } from "@/lib/api";
import { AccountingNav } from "@/components/AccountingNav";

interface Account {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  sub_type: string | null;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  currency: string;
  total_debit: number;
  total_credit: number;
  current_balance: number;
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // New account modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("ASSET");
  const [newSubType, setNewSubType] = useState("Current Assets");
  const [newDesc, setNewDesc] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<Account[]>("/accounting/accounts");
      setAccounts(data || []);
    } catch (err) {
      console.error("Failed to load chart of accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleStartEdit = (acc: Account) => {
    setEditingId(acc.id);
    setEditCode(acc.account_code);
    setEditName(acc.account_name);
    setEditDesc(acc.description || "");
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await fetchApi(`/accounting/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_code: editCode,
          account_name: editName,
          description: editDesc,
        }),
      });
      setEditingId(null);
      await loadAccounts();
    } catch (err: any) {
      alert(err.message || "Failed to update account.");
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await fetchApi("/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_code: newCode,
          account_name: newName,
          account_type: newType,
          sub_type: newSubType,
          description: newDesc,
        }),
      });
      setIsModalOpen(false);
      setNewCode("");
      setNewName("");
      setNewDesc("");
      await loadAccounts();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create account.");
    }
  };

  const filtered = accounts.filter((a) => {
    const matchesSearch =
      a.account_code.toLowerCase().includes(search.toLowerCase()) ||
      a.account_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.sub_type && a.sub_type.toLowerCase().includes(search.toLowerCase()));

    const matchesType = selectedType === "ALL" || a.account_type === selectedType;
    return matchesSearch && matchesType;
  });

  const categories = [
    { id: "ALL", label: "All Accounts" },
    { id: "ASSET", label: "1000 Assets" },
    { id: "LIABILITY", label: "2000 Liabilities" },
    { id: "EQUITY", label: "3000 Equity" },
    { id: "REVENUE", label: "4000 Revenue" },
    { id: "COGS", label: "5000 Cost of Goods Sold" },
    { id: "EXPENSE", label: "6000 Operating Expenses" },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ListTree className="w-7 h-7 text-sky-600" />
            Chart of Accounts
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            AQ COMPANIES • Standardized General Ledger Account Codes (Fully Editable)
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add New Account</span>
        </button>
      </div>

      <AccountingNav />

      {/* Filter and Category Pills */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedType(c.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                selectedType === c.id
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search code or account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-xs w-full"
          />
        </div>
      </div>

      {/* Accounts Data Table */}
      <div className="table-container shadow-2xs">
        <table className="table">
          <thead>
            <tr>
              <th className="w-24">Code</th>
              <th>Account Name</th>
              <th>Type</th>
              <th>Classification / Subtype</th>
              <th className="text-right">Debit Activity</th>
              <th className="text-right">Credit Activity</th>
              <th className="text-right">Current Balance</th>
              <th className="text-center w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                  Loading Chart of Accounts...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                  No accounts found matching your search.
                </td>
              </tr>
            ) : (
              filtered.map((acc) => {
                const isEditing = editingId === acc.id;

                return (
                  <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          className="input font-mono text-xs w-20 py-1 px-2"
                        />
                      ) : (
                        acc.account_code
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="input text-xs w-full py-1 px-2 font-semibold"
                        />
                      ) : (
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {acc.account_name}
                          </span>
                          {acc.description && (
                            <p className="text-[10px] text-slate-400 truncate max-w-xs">
                              {acc.description}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    <td>
                      <span
                        className={`badge text-[10px] ${
                          acc.account_type === "ASSET"
                            ? "badge-info"
                            : acc.account_type === "LIABILITY"
                            ? "badge-warning"
                            : acc.account_type === "EQUITY"
                            ? "badge-neutral"
                            : acc.account_type === "REVENUE"
                            ? "badge-success"
                            : acc.account_type === "COGS"
                            ? "badge-danger"
                            : "badge-neutral"
                        }`}
                      >
                        {acc.account_type}
                      </span>
                    </td>

                    <td className="text-slate-500 text-xs">
                      {acc.sub_type || "Standard"}
                    </td>

                    <td className="text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                      {acc.total_debit > 0 ? formatUSD(acc.total_debit) : "—"}
                    </td>

                    <td className="text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                      {acc.total_credit > 0 ? formatUSD(acc.total_credit) : "—"}
                    </td>

                    <td className="text-right font-mono font-bold text-xs">
                      <span
                        className={
                          acc.current_balance < 0
                            ? "text-amber-600 dark:text-amber-400"
                            : acc.current_balance > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400"
                        }
                      >
                        {formatUSD(acc.current_balance)}
                      </span>
                    </td>

                    <td className="text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleSaveEdit(acc.id)}
                            className="p-1 rounded hover:bg-emerald-100 text-emerald-600"
                            title="Save Changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(acc)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-sky-600"
                          title="Edit Code or Name"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Add Account to Chart of Accounts
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateAccount} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Account Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1500"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="input w-full font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Account Type *</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="select w-full"
                  >
                    <option value="ASSET">ASSET</option>
                    <option value="LIABILITY">LIABILITY</option>
                    <option value="EQUITY">EQUITY</option>
                    <option value="REVENUE">REVENUE</option>
                    <option value="COGS">COGS</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Warehouse Security Deposit"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Classification / Subtype</label>
                <input
                  type="text"
                  placeholder="e.g. Current Assets / Direct Costs"
                  value={newSubType}
                  onChange={(e) => setNewSubType(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Purpose of this account..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary font-bold">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
