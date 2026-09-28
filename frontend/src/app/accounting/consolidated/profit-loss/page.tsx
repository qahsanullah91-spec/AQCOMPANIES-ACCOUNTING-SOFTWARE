"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { API_BASE } from "@/lib/api";

export default function ConsolidatedProfitLossPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const fetchPnL = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const res = await fetch(`${API_BASE}/accounting/consolidated/profit-loss?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching consolidated P&L:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnL();
  }, []);

  const companies: Array<{ id: number; company_code: string; company_name: string }> = data?.companies || [];
  const revenueRows = data?.revenue_rows || [];
  const cogsRows = data?.cogs_rows || [];
  const expenseRows = data?.expense_rows || [];
  const summary = data?.summary || {};
  const consolidated = summary.consolidated || {};
  const byCompany = summary.by_company || {};

  const grossMargin = consolidated.total_revenue > 0
    ? ((consolidated.gross_profit / consolidated.total_revenue) * 100).toFixed(1)
    : "0.0";
  const netMargin = consolidated.total_revenue > 0
    ? ((consolidated.net_profit / consolidated.total_revenue) * 100).toFixed(1)
    : "0.0";

  const handleExportCSV = () => {
    if (!data) return;
    const headers = [
      "Account Code",
      "Account Name",
      ...companies.map((c) => c.company_name),
      "Eliminations",
      "Consolidated Total",
    ];

    const formatRow = (r: any) => [
      r.account_code,
      `"${r.account_name}"`,
      ...companies.map((c) => r.company_balances[`company_${c.id}`] || 0),
      r.eliminations || 0,
      r.consolidated_total || 0,
    ].join(",");

    const csvContent = [
      headers.join(","),
      "--- OPERATING REVENUE ---",
      ...revenueRows.map(formatRow),
      `Total Revenue,,${companies.map((c) => byCompany[`company_${c.id}`]?.total_revenue || 0).join(",")},0,${consolidated.total_revenue || 0}`,
      "--- COST OF GOODS SOLD ---",
      ...cogsRows.map(formatRow),
      `Total COGS,,${companies.map((c) => byCompany[`company_${c.id}`]?.total_cogs || 0).join(",")},0,${consolidated.total_cogs || 0}`,
      `GROSS PROFIT,,${companies.map((c) => byCompany[`company_${c.id}`]?.gross_profit || 0).join(",")},0,${consolidated.gross_profit || 0}`,
      "--- OPERATING EXPENSES ---",
      ...expenseRows.map(formatRow),
      `Total Expenses,,${companies.map((c) => byCompany[`company_${c.id}`]?.total_expenses || 0).join(",")},0,${consolidated.total_expenses || 0}`,
      `NET PROFIT,,${companies.map((c) => byCompany[`company_${c.id}`]?.net_profit || 0).join(",")},0,${consolidated.net_profit || 0}`,
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Consolidated_Profit_Loss_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AccountingNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  Consolidated Statement of Profit & Loss
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    data?.report_status === "FINAL"
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                      : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {data?.report_status || "LOADING"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Multi-entity consolidation with automated intercompany transaction eliminations
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-0 text-slate-700 dark:text-slate-200 text-xs focus:ring-0 p-0"
              title="Start Date"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-0 text-slate-700 dark:text-slate-200 text-xs focus:ring-0 p-0"
              title="End Date"
            />
          </div>

          <button
            onClick={fetchPnL}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Apply</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {data?.preliminary_reasons?.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">PRELIMINARY REPORT NOTICE:</span> Accounting records are undergoing active processing: {data.preliminary_reasons.join(", ")}. Incomplete costs will not inflate reported profits.
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs text-slate-500 mb-1">Group Operating Revenue</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ${(consolidated.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Gross Invoiced Cargo Sales</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs text-slate-500 mb-1">Cost of Goods Sold (COGS)</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ${(consolidated.total_cogs || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Procurement, Freight & Border Port Fees</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs text-slate-500 mb-1">Consolidated Gross Profit</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            ${(consolidated.gross_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            {grossMargin}% Gross Margin
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-xs text-slate-500 mb-1">Consolidated Net Profit</div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
            ${(consolidated.net_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-sky-600 font-semibold mt-1">
            {netMargin}% Net Margin
          </div>
        </div>
      </div>

      {/* Multi-Column Report Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4 min-w-[200px]">Account</th>
                {companies.map((c) => (
                  <th key={c.id} className="py-3 px-3 text-right font-mono font-bold min-w-[120px]">
                    <div>{c.company_name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">({c.company_code})</div>
                  </th>
                ))}
                <th className="py-3 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400 min-w-[110px]">
                  Eliminations
                </th>
                <th className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white bg-slate-200/50 dark:bg-slate-800 min-w-[130px]">
                  Consolidated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {/* OPERATING REVENUE SECTION */}
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 font-sans font-bold text-slate-800 dark:text-slate-200">
                <td colSpan={companies.length + 3} className="py-2 px-4 uppercase tracking-wider text-[11px]">
                  1. Operating Revenue
                </td>
              </tr>
              {revenueRows.map((r: any) => (
                <tr key={r.account_code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-2 px-4 font-sans">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{r.account_name}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({r.account_code})</span>
                  </td>
                  {companies.map((c) => (
                    <td key={c.id} className="py-2 px-3 text-right">
                      ${(r.company_balances[`company_${c.id}`] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">
                    ${(r.eliminations || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-4 text-right font-bold text-slate-900 dark:text-white bg-slate-50/30 dark:bg-slate-800/30">
                    ${(r.consolidated_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              <tr className="bg-sky-50/40 dark:bg-sky-950/20 font-bold border-t border-b border-sky-100 dark:border-sky-900">
                <td className="py-2.5 px-4 font-sans text-sky-900 dark:text-sky-300">Total Operating Revenue</td>
                {companies.map((c) => (
                  <td key={c.id} className="py-2.5 px-3 text-right text-sky-900 dark:text-sky-300">
                    ${(byCompany[`company_${c.id}`]?.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">$0.00</td>
                <td className="py-2.5 px-4 text-right text-sky-900 dark:text-sky-200 bg-sky-100/30 dark:bg-sky-900/30">
                  ${(consolidated.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* COGS SECTION */}
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 font-sans font-bold text-slate-800 dark:text-slate-200">
                <td colSpan={companies.length + 3} className="py-2 px-4 uppercase tracking-wider text-[11px] pt-4">
                  2. Cost of Goods Sold & Direct Logistics
                </td>
              </tr>
              {cogsRows.map((r: any) => (
                <tr key={r.account_code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-2 px-4 font-sans">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{r.account_name}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({r.account_code})</span>
                  </td>
                  {companies.map((c) => (
                    <td key={c.id} className="py-2 px-3 text-right">
                      ${(r.company_balances[`company_${c.id}`] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">
                    ${(r.eliminations || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-4 text-right font-bold text-slate-900 dark:text-white bg-slate-50/30 dark:bg-slate-800/30">
                    ${(r.consolidated_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              <tr className="bg-rose-50/40 dark:bg-rose-950/20 font-bold border-t border-b border-rose-100 dark:border-rose-900">
                <td className="py-2.5 px-4 font-sans text-rose-900 dark:text-rose-300">Total Direct Costs</td>
                {companies.map((c) => (
                  <td key={c.id} className="py-2.5 px-3 text-right text-rose-900 dark:text-rose-300">
                    ${(byCompany[`company_${c.id}`]?.total_cogs || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">$0.00</td>
                <td className="py-2.5 px-4 text-right text-rose-900 dark:text-rose-200 bg-rose-100/30 dark:bg-rose-900/30">
                  ${(consolidated.total_cogs || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* GROSS PROFIT ROW */}
              <tr className="bg-emerald-50 dark:bg-emerald-950/40 font-black text-sm border-t-2 border-b-2 border-emerald-300 dark:border-emerald-700">
                <td className="py-3 px-4 font-sans text-emerald-900 dark:text-emerald-200">GROSS PROFIT</td>
                {companies.map((c) => (
                  <td key={c.id} className="py-3 px-3 text-right text-emerald-900 dark:text-emerald-200">
                    ${(byCompany[`company_${c.id}`]?.gross_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                ))}
                <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400">$0.00</td>
                <td className="py-3 px-4 text-right text-emerald-900 dark:text-emerald-100 bg-emerald-100/60 dark:bg-emerald-900/40">
                  ${(consolidated.gross_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* OPERATING EXPENSES SECTION */}
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 font-sans font-bold text-slate-800 dark:text-slate-200">
                <td colSpan={companies.length + 3} className="py-2 px-4 uppercase tracking-wider text-[11px] pt-4">
                  3. Operating & Administrative Expenses
                </td>
              </tr>
              {expenseRows.length === 0 ? (
                <tr>
                  <td colSpan={companies.length + 3} className="py-2 px-4 text-slate-400 font-sans">
                    No operating expenses recorded in period.
                  </td>
                </tr>
              ) : (
                expenseRows.map((r: any) => (
                  <tr key={r.account_code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 font-sans">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{r.account_name}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({r.account_code})</span>
                    </td>
                    {companies.map((c) => (
                      <td key={c.id} className="py-2 px-3 text-right">
                        ${(r.company_balances[`company_${c.id}`] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">
                      ${(r.eliminations || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-slate-900 dark:text-white bg-slate-50/30 dark:bg-slate-800/30">
                      ${(r.consolidated_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}

              {/* NET PROFIT FINAL ROW */}
              <tr className="bg-sky-100 dark:bg-sky-950/70 font-black text-base border-t-2 border-b-4 border-double border-sky-400 dark:border-sky-600">
                <td className="py-3 px-4 font-sans text-sky-950 dark:text-sky-100">CONSOLIDATED NET PROFIT</td>
                {companies.map((c) => (
                  <td key={c.id} className="py-3 px-3 text-right text-sky-950 dark:text-sky-100">
                    ${(byCompany[`company_${c.id}`]?.net_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                ))}
                <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400">$0.00</td>
                <td className="py-3 px-4 text-right text-sky-950 dark:text-sky-100 bg-sky-200/60 dark:bg-sky-900/60">
                  ${(consolidated.net_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
