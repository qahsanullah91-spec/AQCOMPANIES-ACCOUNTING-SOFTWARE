"use client";

import React, { useState, useEffect } from "react";
import {
  Scale,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowRightLeft,
  ShieldCheck,
} from "lucide-react";
import { AccountingNav } from "@/components/AccountingNav";
import { API_BASE } from "@/lib/api";

export default function ConsolidatedBalanceSheetPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [asOfDate, setAsOfDate] = useState<string>("");

  const fetchBalanceSheet = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (asOfDate) params.set("as_of_date", asOfDate);
      const res = await fetch(`${API_BASE}/accounting/consolidated/balance-sheet?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching consolidated Balance Sheet:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceSheet();
  }, []);

  const companies: Array<{ id: number; company_code: string; company_name: string }> = data?.companies || [];
  const assetRows = data?.asset_rows || [];
  const liabilityRows = data?.liability_rows || [];
  const equityRows = data?.equity_rows || [];
  const summary = data?.summary || {};
  const consolidated = summary.consolidated || {};
  const byCompany = summary.by_company || {};
  const eliminations = summary.eliminations || {};

  const totalAssets = consolidated.total_assets || 0;
  const totalLiab = consolidated.total_liabilities || 0;
  const totalEq = consolidated.total_equity || 0;
  const liabAndEquity = consolidated.liabilities_and_equity || (totalLiab + totalEq);
  const isBalanced = consolidated.is_balanced ?? Math.abs(totalAssets - liabAndEquity) < 0.05;
  const outOfBalanceAmt = Math.abs(totalAssets - liabAndEquity);

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
      "--- ASSETS ---",
      ...assetRows.map(formatRow),
      `TOTAL ASSETS,,${companies.map((c) => byCompany[`company_${c.id}`]?.total_assets || 0).join(",")},${eliminations.asset_eliminations || 0},${totalAssets}`,
      "--- LIABILITIES ---",
      ...liabilityRows.map(formatRow),
      `TOTAL LIABILITIES,,${companies.map((c) => byCompany[`company_${c.id}`]?.total_liabilities || 0).join(",")},${eliminations.liability_eliminations || 0},${totalLiab}`,
      "--- EQUITY ---",
      ...equityRows.map(formatRow),
      `TOTAL EQUITY,,${companies.map((c) => byCompany[`company_${c.id}`]?.total_equity || 0).join(",")},0,${totalEq}`,
      `TOTAL LIABILITIES & EQUITY,,${companies.map((c) => ((byCompany[`company_${c.id}`]?.total_liabilities || 0) + (byCompany[`company_${c.id}`]?.total_equity || 0)).toFixed(2)).join(",")},${eliminations.liability_eliminations || 0},${liabAndEquity}`,
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Consolidated_Balance_Sheet_${Date.now()}.csv`);
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
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">
                  Consolidated Balance Sheet
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isBalanced
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                      : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400"
                  }`}
                >
                  {isBalanced ? "BALANCED (A = L + E)" : "OUT OF BALANCE"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Multi-entity statement of financial position with automated intercompany Due To / Due From eliminations
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>As of:</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="bg-transparent border-0 text-xs font-semibold focus:ring-0 p-0 text-slate-900 dark:text-slate-100"
            />
          </div>

          <button
            onClick={fetchBalanceSheet}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Update</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Balance Verification Banner */}
      <div
        className={`p-4 rounded-xl border flex items-center justify-between ${
          isBalanced
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
            : "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200"
        }`}
      >
        <div className="flex items-center space-x-3">
          {isBalanced ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <div>
            <div className="text-xs font-black uppercase tracking-wider">
              {isBalanced ? "Accounting Equation Verified" : "Accounting Imbalance Detected"}
            </div>
            <div className="text-xs font-mono mt-0.5">
              Consolidated Assets:{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>{" "}
              = Liabilities & Equity:{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                ${liabAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>{" "}
              (Variance: ${outOfBalanceAmt.toFixed(2)})
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-indigo-500" />
          <span>Intercompany Eliminations: ${(eliminations.asset_eliminations || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Group Assets</div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Cash, Bank, A/R, Inventory, Advances</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Group Liabilities</div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
            ${totalLiab.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Payables, Accruals, Transport Liabilities</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Group Equity</div>
          <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            ${totalEq.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Capital, Retained Earnings & YTD Profit</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Intercompany Eliminations</div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
            ${(eliminations.asset_eliminations || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Dual offset: Dr 2350 / Cr 1370</div>
        </div>
      </div>

      {/* Main Multi-Company Balance Sheet Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3 w-16">Code</th>
                <th className="py-3 px-3 min-w-[200px]">Account Name</th>
                {companies.map((c) => (
                  <th key={c.id} className="py-3 px-3 text-right min-w-[130px]">
                    <div className="truncate">{c.company_name}</div>
                    <div className="text-[9px] font-mono text-slate-400">({c.company_code})</div>
                  </th>
                ))}
                <th className="py-3 px-3 text-right min-w-[110px] bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  Eliminations
                </th>
                <th className="py-3 px-3 text-right min-w-[140px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-black">
                  Consolidated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {/* SECTION 1: ASSETS */}
              <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 font-sans font-bold text-xs">
                <td colSpan={2 + companies.length + 2} className="py-2.5 px-3 uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  1. Assets (Current & Non-Current)
                </td>
              </tr>
              {assetRows.length === 0 ? (
                <tr>
                  <td colSpan={2 + companies.length + 2} className="py-4 text-center text-slate-400">
                    No asset balances found.
                  </td>
                </tr>
              ) : (
                assetRows.map((r: any) => (
                  <tr key={r.account_code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 text-slate-500">{r.account_code}</td>
                    <td className="py-2 px-3 font-sans text-slate-800 dark:text-slate-200">
                      {r.account_name}
                      {r.account_code === "1370" && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-sans">
                          Intercompany
                        </span>
                      )}
                    </td>
                    {companies.map((c) => {
                      const val = r.company_balances[`company_${c.id}`] || 0;
                      return (
                        <td key={c.id} className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                          {val !== 0 ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right bg-amber-500/5 text-amber-700 dark:text-amber-400 font-semibold">
                      {r.eliminations !== 0 ? `($${r.eliminations.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right bg-indigo-500/5 text-slate-900 dark:text-white font-bold">
                      ${r.consolidated_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
              {/* Assets Total Row */}
              <tr className="bg-slate-100/90 dark:bg-slate-800/80 font-bold border-t-2 border-b-2 border-slate-300 dark:border-slate-700">
                <td colSpan={2} className="py-2.5 px-3 font-sans text-slate-900 dark:text-white uppercase tracking-wider">
                  TOTAL ASSETS
                </td>
                {companies.map((c) => {
                  const compTot = byCompany[`company_${c.id}`]?.total_assets || 0;
                  return (
                    <td key={c.id} className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                      ${compTot.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-right text-amber-700 dark:text-amber-400 bg-amber-500/10">
                  {eliminations.asset_eliminations ? `($${eliminations.asset_eliminations.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : "-"}
                </td>
                <td className="py-2.5 px-3 text-right text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 font-black">
                  ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* SECTION 2: LIABILITIES */}
              <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 font-sans font-bold text-xs">
                <td colSpan={2 + companies.length + 2} className="py-2.5 px-3 uppercase tracking-wider text-rose-600 dark:text-rose-400 pt-4">
                  2. Liabilities (Current & Non-Current)
                </td>
              </tr>
              {liabilityRows.length === 0 ? (
                <tr>
                  <td colSpan={2 + companies.length + 2} className="py-4 text-center text-slate-400">
                    No liability balances found.
                  </td>
                </tr>
              ) : (
                liabilityRows.map((r: any) => (
                  <tr key={r.account_code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 text-slate-500">{r.account_code}</td>
                    <td className="py-2 px-3 font-sans text-slate-800 dark:text-slate-200">
                      {r.account_name}
                      {r.account_code === "2350" && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-sans">
                          Intercompany
                        </span>
                      )}
                    </td>
                    {companies.map((c) => {
                      const val = r.company_balances[`company_${c.id}`] || 0;
                      return (
                        <td key={c.id} className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                          {val !== 0 ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right bg-amber-500/5 text-amber-700 dark:text-amber-400 font-semibold">
                      {r.eliminations !== 0 ? `($${r.eliminations.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right bg-indigo-500/5 text-slate-900 dark:text-white font-bold">
                      ${r.consolidated_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
              {/* Liabilities Total Row */}
              <tr className="bg-slate-100/90 dark:bg-slate-800/80 font-bold border-t border-b border-slate-300 dark:border-slate-700">
                <td colSpan={2} className="py-2.5 px-3 font-sans text-slate-900 dark:text-white uppercase tracking-wider">
                  TOTAL LIABILITIES
                </td>
                {companies.map((c) => {
                  const compTot = byCompany[`company_${c.id}`]?.total_liabilities || 0;
                  return (
                    <td key={c.id} className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                      ${compTot.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-right text-amber-700 dark:text-amber-400 bg-amber-500/10">
                  {eliminations.liability_eliminations ? `($${eliminations.liability_eliminations.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : "-"}
                </td>
                <td className="py-2.5 px-3 text-right text-rose-700 dark:text-rose-400 bg-rose-500/10 font-black">
                  ${totalLiab.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* SECTION 3: EQUITY */}
              <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 font-sans font-bold text-xs">
                <td colSpan={2 + companies.length + 2} className="py-2.5 px-3 uppercase tracking-wider text-emerald-600 dark:text-emerald-400 pt-4">
                  3. Equity & Retained Earnings
                </td>
              </tr>
              {equityRows.map((r: any) => (
                <tr key={r.account_code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2 px-3 text-slate-500">{r.account_code}</td>
                  <td className="py-2 px-3 font-sans text-slate-800 dark:text-slate-200">
                    {r.account_name}
                    {r.account_code === "3999" && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-sans">
                        P&L Link
                      </span>
                    )}
                  </td>
                  {companies.map((c) => {
                    const val = r.company_balances[`company_${c.id}`] || 0;
                    return (
                      <td key={c.id} className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                        {val !== 0 ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 text-right bg-amber-500/5 text-amber-700 dark:text-amber-400 font-semibold">
                    -
                  </td>
                  <td className="py-2 px-3 text-right bg-indigo-500/5 text-slate-900 dark:text-white font-bold">
                    ${r.consolidated_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {/* Equity Total Row */}
              <tr className="bg-slate-100/90 dark:bg-slate-800/80 font-bold border-t border-b border-slate-300 dark:border-slate-700">
                <td colSpan={2} className="py-2.5 px-3 font-sans text-slate-900 dark:text-white uppercase tracking-wider">
                  TOTAL EQUITY
                </td>
                {companies.map((c) => {
                  const compTot = byCompany[`company_${c.id}`]?.total_equity || 0;
                  return (
                    <td key={c.id} className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                      ${compTot.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-right text-amber-700 dark:text-amber-400 bg-amber-500/10">
                  -
                </td>
                <td className="py-2.5 px-3 text-right text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 font-black">
                  ${totalEq.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* MASTER BALANCING ROW: LIABILITIES + EQUITY */}
              <tr className="bg-slate-200/90 dark:bg-slate-800 font-black text-xs border-t-2 border-b-4 border-slate-400 dark:border-slate-600">
                <td colSpan={2} className="py-3 px-3 font-sans uppercase tracking-wider text-slate-900 dark:text-white">
                  TOTAL LIABILITIES & EQUITY
                </td>
                {companies.map((c) => {
                  const compLiab = byCompany[`company_${c.id}`]?.total_liabilities || 0;
                  const compEq = byCompany[`company_${c.id}`]?.total_equity || 0;
                  const compSum = compLiab + compEq;
                  return (
                    <td key={c.id} className="py-3 px-3 text-right text-slate-900 dark:text-white">
                      ${compSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className="py-3 px-3 text-right text-amber-700 dark:text-amber-400 bg-amber-500/10">
                  {eliminations.liability_eliminations ? `($${eliminations.liability_eliminations.toLocaleString(undefined, { minimumFractionDigits: 2 })})` : "-"}
                </td>
                <td className="py-3 px-3 text-right text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 font-black text-sm">
                  ${liabAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Footnote */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-start space-x-3">
        <ArrowRightLeft className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
        <div>
          <div className="font-bold text-slate-800 dark:text-slate-200">Consolidated Accounting Notes:</div>
          <p className="mt-0.5">
            Intercompany account balances (Account 1370 "Due From Related Companies" and Account 2350 "Due To Related Companies") are automatically eliminated during group consolidation.
            Third-party customer receivables, supplier payables, trade inventory, and banking liquidity remain segregated and are fully aggregated across the group.
          </p>
        </div>
      </div>
    </div>
  );
}
