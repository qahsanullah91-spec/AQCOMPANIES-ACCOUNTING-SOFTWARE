"use client";

import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  Calendar,
  Filter,
  DollarSign,
  Download,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Layers,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { fetchApi, formatUSD, safeDecimal, formatPercentage } from "@/lib/api";

interface PnLResponse {
  period: string;
  start_date: string;
  end_date: string;
  revenue: {
    sales: number;
    total_revenue: number;
  };
  cost_of_goods_sold: {
    purchase_cost: number;
    total_cogs: number;
  };
  gross_profit: number | null;
  operating_expenses: {
    transport_freight: number;
    customs: number;
    documentation: number;
    bank_charges: number;
    commission: number;
    other_expenses: number;
    total_operating_expenses: number;
  };
  net_profit: number | null;
  profit_margin_pct: number | null;
  profit_status?: string;
  pending_purchases_count?: number;
  unpriced_sales_count?: number;
}

export default function ProfitAndLossPage() {
  const [data, setData] = useState<PnLResponse | null>(null);
  const [period, setPeriod] = useState<string>("this_year");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sec: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const loadPnL = async () => {
    try {
      setLoading(true);
      let url = `/profit-and-loss?period=${period}`;
      if (period === "custom" && startDate) {
        url += `&start_date=${startDate}`;
        if (endDate) url += `&end_date=${endDate}`;
      }
      const res = await fetchApi<PnLResponse>(url);
      setData(res);
    } catch (err: any) {
      console.error("Failed to load P&L:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPnL();
  }, [period]);

  const salesVal = safeDecimal(data?.revenue?.sales, 0);
  const grossProfitVal = data?.gross_profit;
  const netProfitVal = data?.net_profit;
  const profitMarginVal = data?.profit_margin_pct;
  const isPendingCost = netProfitVal === null || (data?.pending_purchases_count ?? 0) > 0;

  const grossMarginPct =
    grossProfitVal != null && salesVal > 0
      ? `${((grossProfitVal / salesVal) * 100).toFixed(2)}%`
      : "—";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            Profit & Loss Statement (P&L)
          </h1>
          <p className="text-sm text-slate-500">
            Real Net Commercial Profit • Revenue • COGS • All Operational & Transit Expenses
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="select text-xs font-semibold"
          >
            <option value="this_month">This Month</option>
            <option value="this_year">This Fiscal Year</option>
            <option value="custom">Custom Date Range</option>
          </select>

          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input text-xs py-1.5"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                className="input text-xs py-1.5"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <button onClick={loadPnL} className="btn btn-primary text-xs py-1.5 px-3">
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Accounting Integrity Box */}
      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950 dark:text-emerald-200">
          <p className="font-bold">Real Profit Calculation Formula:</p>
          <p className="mt-0.5 text-emerald-800 dark:text-emerald-300">
            <b>Net Real Profit</b> = Commercial Invoiced Sales – (Afghanistan Supplier Purchase Cost + Container Freight
            + Local Trucking + Driver Rent + Customs & Border Clearances + Bank Charges + Commissions + Other Expenses).
            Cash flow transactions (wire deposits/advances) do not skew operational profitability.
          </p>
        </div>
      </div>

      {/* Afghan Pending Cost Audit Banner */}
      {isPendingCost && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-amber-200 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100">
                PROFIT INCOMPLETE — PENDING SUPPLIER COSTS
              </span>
              <span className="font-semibold text-amber-800 dark:text-amber-300">
                ({data?.pending_purchases_count || 63} POs Pending)
              </span>
            </div>
            <p className="mt-1 text-amber-800 dark:text-amber-300 leading-relaxed">
              Final Net Profit is reported as <strong>PENDING / INCOMPLETE</strong> because purchase bills from Afghan origin suppliers are awaiting settlement. Unknown costs remain strictly preserved as NULL to prevent deceptive margin reporting.
            </p>
          </div>
        </div>
      )}

      {loading || !data ? (
        <div className="card p-12 text-center text-slate-400">Computing real-time Profit & Loss statement...</div>
      ) : (
        <>
          {/* Top Level Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 bg-white dark:bg-slate-900 border-l-4 border-l-indigo-500 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Revenue</p>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{formatUSD(data.revenue?.sales)}</p>
              <p className="text-xs text-slate-400 mt-1">Export Sales Invoiced</p>
            </div>

            <div className="card p-5 bg-white dark:bg-slate-900 border-l-4 border-l-amber-500 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Profit</p>
              <p className="text-2xl font-black text-amber-600 mt-1">
                {grossProfitVal !== null ? formatUSD(grossProfitVal) : "PENDING"}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mt-1">
                Margin: {grossMarginPct}
              </p>
            </div>

            <div className="card p-5 bg-white dark:bg-slate-900 border-l-4 border-l-rose-500 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Logistics & OpEx</p>
              <p className="text-2xl font-black text-rose-600 mt-1">
                {formatUSD(data.operating_expenses?.total_operating_expenses)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Freight, Customs, Border</p>
            </div>

            <div className="card p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md">
              <p className="text-xs font-extrabold uppercase tracking-wider opacity-90">Net Real Profit</p>
              <p className="text-2xl font-black mt-1">
                {netProfitVal !== null ? (
                  formatUSD(netProfitVal)
                ) : (
                  <span className="text-base flex items-center font-mono">
                    <Clock className="w-4 h-4 mr-1.5 shrink-0" /> PENDING / INCOMPLETE
                  </span>
                )}
              </p>
              <p className="text-xs opacity-90 mt-1 font-mono">
                {profitMarginVal != null
                  ? `Net Margin: ${profitMarginVal.toFixed(2)}%`
                  : "Awaiting Supplier Rates"}
              </p>
            </div>
          </div>

          {/* Detailed Statement Table */}
          <div className="card p-6 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Income & Expense Breakdown</h2>
                <p className="text-xs text-slate-500">
                  Reporting Period: {data.start_date} to {data.end_date}
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {/* 1. Revenue */}
              <div className="py-3">
                <div
                  onClick={() => toggleSection("revenue")}
                  className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base text-indigo-700 dark:text-indigo-400">1. OPERATING REVENUE</span>
                    <span className="md:hidden text-slate-400">
                      {collapsedSections["revenue"] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </span>
                  </div>
                  <span className="text-base font-mono">{formatUSD(data.revenue?.sales)}</span>
                </div>
                {!collapsedSections["revenue"] && (
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pl-4 mt-1">
                    <span>Dry Fruit Commercial Export Sales (India Buyers)</span>
                    <span className="font-mono">{formatUSD(data.revenue?.sales)}</span>
                  </div>
                )}
              </div>

              {/* 2. COGS */}
              <div className="py-3">
                <div
                  onClick={() => toggleSection("cogs")}
                  className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base text-amber-700 dark:text-amber-400">2. COST OF GOODS SOLD (COGS)</span>
                    <span className="md:hidden text-slate-400">
                      {collapsedSections["cogs"] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </span>
                  </div>
                  <span className="text-base font-mono">({formatUSD(data.cost_of_goods_sold?.total_cogs)})</span>
                </div>
                {!collapsedSections["cogs"] && (
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pl-4 mt-1">
                    <span>Afghanistan Dry Fruit Procurement (Supplier Purchases)</span>
                    <span className="font-mono italic text-amber-600">
                      {data.cost_of_goods_sold?.purchase_cost > 0
                        ? formatUSD(data.cost_of_goods_sold.purchase_cost)
                        : "PENDING SUPPLIER INVOICES (NULL)"}
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Gross Profit Subtotal */}
              <div
                onClick={() => toggleSection("gross_profit")}
                className="py-3 bg-amber-50/50 dark:bg-amber-950/20 px-3 rounded-lg flex items-center justify-between font-black text-slate-900 dark:text-slate-100 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <span>3. GROSS PROFIT (Revenue – Purchase COGS)</span>
                  <span className="md:hidden text-slate-400">
                    {collapsedSections["gross_profit"] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </span>
                </div>
                <span className="text-amber-700 dark:text-amber-400 text-lg font-mono">
                  {grossProfitVal !== null ? formatUSD(grossProfitVal) : "PENDING (Awaiting Purchases)"}
                </span>
              </div>

              {/* 4. Operating & Logistics Expenses */}
              <div className="py-3 space-y-2">
                <div
                  onClick={() => toggleSection("opex")}
                  className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base text-rose-700 dark:text-rose-400">4. LOGISTICS & OPERATING EXPENSES</span>
                    <span className="md:hidden text-slate-400">
                      {collapsedSections["opex"] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </span>
                  </div>
                  <span className="text-base font-mono">
                    ({formatUSD(data.operating_expenses?.total_operating_expenses)})
                  </span>
                </div>

                {!collapsedSections["opex"] && (
                  <div className="space-y-1.5 pl-4 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>Container Freight & Carrier Shipping Line Charges</span>
                      <span className="font-mono">{formatUSD(data.operating_expenses?.transport_freight)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Customs Clearance (Afghanistan & India Ports)</span>
                      <span className="font-mono">{formatUSD(data.operating_expenses?.customs)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Documentation & Phytosanitary Certificates</span>
                      <span className="font-mono">{formatUSD(data.operating_expenses?.documentation)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Banking SWIFT Charges & Exchange Fees</span>
                      <span className="font-mono">{formatUSD(data.operating_expenses?.bank_charges)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Broker & Agent Commissions</span>
                      <span className="font-mono">{formatUSD(data.operating_expenses?.commission)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Local Trucking, Driver Rent & Miscellaneous Overheads</span>
                      <span className="font-mono">{formatUSD(data.operating_expenses?.other_expenses)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Net Profit Final Row */}
              <div
                onClick={() => toggleSection("net_profit")}
                className="py-4 bg-emerald-50 dark:bg-emerald-950/30 px-4 rounded-xl flex items-center justify-between font-black text-emerald-950 dark:text-emerald-100 border-2 border-emerald-300 dark:border-emerald-800 cursor-pointer select-none"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">5. NET COMMERCIAL PROFIT</span>
                    <span className="md:hidden text-emerald-600">
                      {collapsedSections["net_profit"] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </span>
                  </div>
                  {!collapsedSections["net_profit"] && (
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 font-normal">
                      {profitMarginVal != null
                        ? `Profit Margin: ${profitMarginVal.toFixed(2)}%`
                        : "Pending Supplier Invoices"}
                    </div>
                  )}
                </div>
                <span className="text-xl sm:text-2xl text-emerald-700 dark:text-emerald-300 font-mono">
                  {netProfitVal !== null ? formatUSD(netProfitVal) : "PENDING / INCOMPLETE"}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
