"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Download,
  Filter,
  Search,
  Printer,
  ChevronDown,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { fetchApi, formatUSD, formatRate, formatWeight, formatNumber } from "@/lib/api";

const REPORTS_LIST = [
  { id: "profit-per-container", title: "1. Profit Per Container Report" },
  { id: "profit-per-kg", title: "2. Profit Per KG Analysis" },
  { id: "profit-per-carton", title: "3. Profit Per Carton Analysis" },
  { id: "customer-outstanding", title: "4. Customer Outstanding Balance Report" },
  { id: "supplier-outstanding", title: "5. Supplier Payable Balance Report" },
  { id: "transport-outstanding", title: "6. Transport Company Outstanding & Credit Report" },
  { id: "bank-cash-book", title: "7. Bank & Cash Book" },
  { id: "container-movement", title: "8. Container Movement & Status Register" },
  { id: "invoice-register", title: "9. Commercial & Proforma Invoice Register" },
  { id: "purchase-register", title: "10. Dry Fruit Purchase Register" },
  { id: "expense-register", title: "11. 19-Category Expense Register" },
  { id: "sales-by-product", title: "12. Sales by Product Variety" },
  { id: "sales-by-customer", title: "13. Sales by Customer / Buyer" },
  { id: "purchases-by-supplier", title: "14. Purchases by Supplier" },
  { id: "freight-cost-analysis", title: "15. Freight & Logistics Cost Analysis" },
  { id: "customs-border-costs", title: "16. Customs & Border Clearance Costs" },
  { id: "unpaid-invoices", title: "17. Unpaid & Overdue Invoices Report" },
  { id: "pnl-summary", title: "18. Monthly & Annual P&L Summary" },
];

export default function ReportsPage() {
  const [selectedReportId, setSelectedReportId] = useState<string>("profit-per-container");
  const [reportData, setReportData] = useState<{ report_name: string; rows: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadReport = async (reportId: string) => {
    try {
      setLoading(true);
      const res = await fetchApi<{ report_name: string; rows: any[] }>(`/reports/${reportId}`);
      setReportData(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(selectedReportId);
  }, [selectedReportId]);

  const filteredRows = (reportData?.rows || []).filter((row) => {
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            18-Report Analytics Center
          </h1>
          <p className="text-sm text-slate-500">
            Export-Ready Business Intelligence • Logistics Auditing • Multi-Currency Accounting Reports
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/excel/export?entity=shipments"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary flex items-center gap-2 text-xs font-semibold"
          >
            <Download className="w-4 h-4" />
            Download Excel
          </a>
          <button
            onClick={() => window.print()}
            className="btn btn-primary flex items-center gap-2 text-xs font-semibold"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Report Selector Grid & Bar */}
      <div className="card p-4 bg-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-96">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Select Report Type:
          </label>
          <select
            value={selectedReportId}
            onChange={(e) => setSelectedReportId(e.target.value)}
            className="select text-sm font-bold w-full"
          >
            {REPORTS_LIST.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-72">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Quick Filter:
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search table rows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs w-full py-1.5"
            />
          </div>
        </div>
      </div>

      {/* Report Content Table */}
      <div className="card overflow-hidden bg-white shadow-sm space-y-3">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {reportData?.report_name || "Business Intelligence Report"}
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filteredRows.length} recorded entries
            </p>
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading report data...</div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-slate-400">No records found for this report.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  {Object.keys(filteredRows[0]).map((col) => (
                    <th key={col} className="uppercase text-[11px]">
                      {col.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    {Object.entries(row).map(([k, val]: [string, any], cIdx) => {
                      const isMoney =
                        k.includes("sales") ||
                        k.includes("cost") ||
                        k.includes("profit") ||
                        k.includes("paid") ||
                        k.includes("due") ||
                        k.includes("balance") ||
                        k.includes("charge");
                      return (
                        <td
                          key={cIdx}
                          className={`text-xs ${
                            isMoney ? "font-bold text-slate-900 font-mono" : "text-slate-700"
                          }`}
                        >
                          {typeof val === "number"
                            ? isMoney
                              ? formatUSD(val)
                              : val
                            : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
