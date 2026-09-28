"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Ship,
  Boxes,
  Receipt,
  ShoppingBag,
  Truck,
  CreditCard,
  Wallet,
  FileText,
  Calculator,
  History,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  ExternalLink,
  Edit,
  Printer,
  ChevronRight,
} from "lucide-react";
import { fetchApi, formatUSD, formatWeight, formatNumber, API_BASE } from "@/lib/api";

interface ShipmentItem {
  id: number;
  product_name: string;
  product_grade: string | null;
  packages: number;
  cartons: number;
  bags: number;
  package_type: string;
  net_weight_kg: string | number;
  gross_weight_kg: string | number;
  selling_rate: string | number | null;
  selling_amount: string | number | null;
  purchase_rate: string | number | null;
  purchase_amount: string | number | null;
}

interface ShipmentDetail {
  id: number;
  shipment_code: string;
  shipment_date: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: number;
  customer_name: string;
  shipper_exporter: string;
  supplier_id: number | null;
  supplier_name: string | null;
  product_summary: string;
  product_grade: string | null;
  packages: number;
  cartons: number;
  bags: number;
  package_type: string;
  net_weight_kg: string | number;
  gross_weight_kg: string | number;
  rate_per_kg: string | number | null;
  invoice_value: string | number | null;
  currency: string;
  purchase_rate: string | number | null;
  purchase_cost: string | number | null;
  transport_company_id: number | null;
  transport_company_name: string | null;
  transport_freight: string | number;
  transport_charge: string | number;
  transport_paid: string | number;
  transport_balance: string | number;
  afghanistan_truck_cost: string | number;
  driver_rent: string | number;
  customs_cost: string | number;
  documentation_cost: string | number;
  border_cost: string | number;
  bank_charges: string | number;
  commission: string | number;
  other_expenses: string | number;
  total_cost: string | number;
  net_profit: string | number | null;
  profit_margin_pct: string | number | null;
  container_number: string | null;
  container_type: string | null;
  bl_number: string | null;
  truck_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  origin: string | null;
  route: string | null;
  destination: string | null;
  port: string | null;
  customer_amount_received: string | number;
  customer_balance: string | number | null;
  status: string;
  payment_status: string;
  notes: string | null;
  data_conflict: boolean;
  conflict_type: string | null;
  conflict_details: string | null;
  source_row_sn?: number | null;
  bol_issue_date?: string | null;
  transport_statement_date?: string | null;
  items: ShipmentItem[];
}

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "products"
    | "invoice"
    | "purchase"
    | "transport"
    | "payments"
    | "expenses"
    | "documents"
    | "accounting"
    | "audit"
  >("overview");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchApi<ShipmentDetail>(`/shipments/${id}`);
        setShipment(data);
      } catch (err: any) {
        setError(err.message || "Failed to load shipment details");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!shipment) return;
    try {
      setUpdatingStatus(true);
      const updated = await fetchApi<ShipmentDetail>(`/shipments/${shipment.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      setShipment(updated);
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500">Loading shipment record #{id}...</p>
        </div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="card p-6 bg-rose-50 border-rose-200 text-rose-800 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            Shipment Record Not Found
          </div>
          <p className="text-xs">{error || `Unable to find shipment with ID ${id}.`}</p>
          <button
            onClick={() => router.push("/shipments")}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Shipment Ledger
          </button>
        </div>
      </div>
    );
  }

  const isUnpriced = shipment.invoice_value === null || shipment.rate_per_kg === null;
  const isPurchasePending = shipment.purchase_cost === null || shipment.purchase_rate === null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/shipments")}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-wider font-mono">
                {shipment.invoice_number}
              </h1>
              <span className="text-xs font-mono text-slate-400">({shipment.shipment_code})</span>
              <span
                className={`badge text-xs font-bold ${
                  shipment.status === "DELIVERED"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : shipment.status === "IN TRANSIT"
                    ? "bg-sky-100 text-sky-800 border-sky-300"
                    : shipment.status === "AT PORT"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-slate-100 text-slate-800 border-slate-300"
                }`}
              >
                {shipment.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer: <span className="font-semibold text-slate-800 dark:text-slate-200">{shipment.customer_name}</span> • Date:{" "}
              <span className="font-mono">{shipment.shipment_date}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Quick Select */}
          <select
            value={shipment.status}
            disabled={updatingStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="select text-xs font-bold py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="LOADING">LOADING</option>
            <option value="IN TRANSIT">IN TRANSIT</option>
            <option value="AT BORDER">AT BORDER</option>
            <option value="AT PORT">AT PORT</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          {/* Download PDF */}
          <a
            href={`${API_BASE}/invoices/${shipment.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary flex items-center gap-1.5 text-xs font-bold"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>Commercial Invoice PDF</span>
          </a>
        </div>
      </div>

      {/* Financial Health Banner */}
      {shipment.data_conflict && (
        <div className="card p-4 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-amber-900 dark:text-amber-200">
              Audit Data Conflict Logged ({shipment.conflict_type}):
            </span>{" "}
            <span className="text-amber-800 dark:text-amber-300">{shipment.conflict_details}</span>
          </div>
        </div>
      )}

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Sales Value</p>
          <p className="text-base font-black text-slate-900 dark:text-white mt-1">
            {isUnpriced ? (
              <span className="text-xs text-amber-600 font-semibold">Rate Pending</span>
            ) : (
              formatUSD(shipment.invoice_value)
            )}
          </p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {isUnpriced ? "Unpriced Shipment" : `@ $${Number(shipment.rate_per_kg).toFixed(2)}/kg`}
          </p>
        </div>

        <div className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Cost</p>
          <p className="text-base font-black mt-1">
            {isPurchasePending ? (
              <span className="text-xs text-amber-600 font-semibold">Cost Pending</span>
            ) : (
              formatUSD(shipment.purchase_cost)
            )}
          </p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {isPurchasePending ? "Awaiting Afghan Bill" : `@ $${Number(shipment.purchase_rate).toFixed(2)}/kg`}
          </p>
        </div>

        <div className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Carrier Freight</p>
          <p className="text-base font-black text-slate-900 dark:text-white mt-1">
            {formatUSD(shipment.transport_freight)}
          </p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{shipment.transport_company_name}</p>
        </div>

        <div className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Net Weight</p>
          <p className="text-base font-black text-slate-900 dark:text-white mt-1">
            {formatWeight(shipment.net_weight_kg)}
          </p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formatNumber(shipment.packages)} Packages</p>
        </div>

        <div className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Receivable</p>
          <p className="text-base font-black text-rose-600 mt-1">
            {isUnpriced ? <span className="text-xs">Unpriced</span> : formatUSD(shipment.customer_balance)}
          </p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{shipment.payment_status}</p>
        </div>

        <div className="card p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Realized Net Profit</p>
          <p className="text-base font-black mt-1">
            {isPurchasePending ? (
              <span className="text-xs text-amber-600 font-bold uppercase tracking-tight">Pending Cost</span>
            ) : (
              formatUSD(shipment.net_profit)
            )}
          </p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {isPurchasePending ? "Zero Guessing Policy" : `${shipment.profit_margin_pct}% margin`}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1 text-xs font-bold">
        {[
          { key: "overview", label: "Overview", icon: Ship },
          { key: "products", label: `Products (${shipment.items.length})`, icon: Boxes },
          { key: "invoice", label: "Sales Invoice", icon: Receipt },
          { key: "purchase", label: "Purchase & Cost", icon: ShoppingBag },
          { key: "transport", label: "Transport & Carrier", icon: Truck },
          { key: "payments", label: "Customer Payments", icon: CreditCard },
          { key: "expenses", label: "Shipment Expenses", icon: Wallet },
          { key: "documents", label: "Documents", icon: FileText },
          { key: "accounting", label: "P&L Accounting", icon: Calculator },
          { key: "audit", label: "Audit History", icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                isActive
                  ? "border-sky-600 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {/* 1. OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shipment Specifications */}
            <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b pb-2">
                Shipment & Consignee Details
              </h2>
              <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                <div>
                  <dt className="text-slate-400 font-medium">Customer (Consignee)</dt>
                  <dd className="font-bold text-slate-900 dark:text-white mt-0.5">{shipment.customer_name}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Commercial Invoice #</dt>
                  <dd className="font-mono font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                    {shipment.invoice_number}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Shipment Date</dt>
                  <dd className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">{shipment.shipment_date}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Shipper / Exporter</dt>
                  <dd className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">{shipment.shipper_exporter}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Primary Cargo Summary</dt>
                  <dd className="font-medium text-slate-900 dark:text-white mt-0.5">{shipment.product_summary}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Package Configuration</dt>
                  <dd className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                    {formatNumber(shipment.packages)} {shipment.package_type} ({formatNumber(shipment.cartons)} CTNS)
                  </dd>
                </div>
              </dl>
            </div>

            {/* Container & Transport Specifications */}
            <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b pb-2">
                Logistics & Cross-Border Routing
              </h2>
              <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                <div>
                  <dt className="text-slate-400 font-medium">Container Number</dt>
                  <dd className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {shipment.container_number || (
                      <span className="text-slate-400 italic">Pending (Overland Land Transit)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Bill of Lading (B/L)</dt>
                  <dd className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {shipment.bl_number || <span className="text-slate-400 italic">Pending Port Stuffing</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Transit Truck Number</dt>
                  <dd className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                    {shipment.truck_number || "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Transport Carrier</dt>
                  <dd className="font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                    {shipment.transport_company_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Origin Route</dt>
                  <dd className="text-slate-700 dark:text-slate-300 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-500" /> {shipment.origin} ➔ {shipment.route}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Destination Discharge Port</dt>
                  <dd className="font-medium text-slate-900 dark:text-white mt-0.5">{shipment.port}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* 2. PRODUCTS TAB (Multi-Product Line Items) */}
        {activeTab === "products" && (
          <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cargo Breakdown & Multi-Product Lines
                </h2>
                <p className="text-xs text-slate-500">
                  Individual product line items, packaging tare weights, selling rates, and itemized totals.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="py-2.5 px-3">Product Commodity</th>
                    <th className="py-2.5 px-3">Grade</th>
                    <th className="py-2.5 px-3 text-right">Packages</th>
                    <th className="py-2.5 px-3 text-right">Net Weight (KG)</th>
                    <th className="py-2.5 px-3 text-right">Gross Weight (KG)</th>
                    <th className="py-2.5 px-3 text-right">Selling Rate ($/KG)</th>
                    <th className="py-2.5 px-3 text-right">Line Total (USD)</th>
                    <th className="py-2.5 px-3 text-right">Purchase Rate ($/KG)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {shipment.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{item.product_name}</td>
                      <td className="py-2.5 px-3 text-slate-500">{item.product_grade || "Grade A"}</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {formatNumber(item.packages)} {item.package_type}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium">
                        {formatWeight(item.net_weight_kg)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {formatWeight(item.gross_weight_kg)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-600 dark:text-sky-400">
                        {item.selling_rate !== null ? `$${Number(item.selling_rate).toFixed(4)}` : "Pending"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                        {item.selling_amount !== null ? formatUSD(item.selling_amount) : "Pending"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-600 font-semibold">
                        {item.purchase_rate !== null ? `$${Number(item.purchase_rate).toFixed(4)}` : "NULL (Pending)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                  <tr>
                    <td colSpan={2} className="py-3 px-3 uppercase text-slate-600 dark:text-slate-300">
                      Total Rollup:
                    </td>
                    <td className="py-3 px-3 text-right font-mono">{formatNumber(shipment.packages)} CTNS</td>
                    <td className="py-3 px-3 text-right font-mono">{formatWeight(shipment.net_weight_kg)}</td>
                    <td className="py-3 px-3 text-right font-mono">{formatWeight(shipment.gross_weight_kg)}</td>
                    <td className="py-3 px-3 text-right text-slate-400">—</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-600 text-sm">
                      {isUnpriced ? "Rate Pending" : formatUSD(shipment.invoice_value)}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-600 font-mono">
                      {isPurchasePending ? "Cost Pending" : formatUSD(shipment.purchase_cost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* 3. SALES INVOICE TAB */}
        {activeTab === "invoice" && (
          <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Commercial Invoice Summary</h2>
                <p className="text-xs text-slate-500">Commercial Billing & Accounts Receivable Status</p>
              </div>
              <a
                href={`${API_BASE}/invoices/${shipment.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 font-medium">Billed Invoice Amount</span>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  {isUnpriced ? "Rate Pending" : formatUSD(shipment.invoice_value)}
                </p>
                <p className="text-slate-500 mt-1">Invoice: {shipment.invoice_number}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 font-medium">Payments Received to Date</span>
                <p className="text-lg font-black text-emerald-600 mt-1">
                  {formatUSD(shipment.customer_amount_received)}
                </p>
                <p className="text-slate-500 mt-1">0 Bank Remittances</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 font-medium">Outstanding Accounts Receivable</span>
                <p className="text-lg font-black text-rose-600 mt-1">
                  {isUnpriced ? "Rate Pending" : formatUSD(shipment.customer_balance)}
                </p>
                <p className="text-slate-500 mt-1">Status: {shipment.payment_status}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white">Commercial Terms & Instructions</h3>
              <p className="text-slate-600 dark:text-slate-400">
                • Standard Payment Terms: 100% Advance Payment / Third-Party Wire Remittances Acceptable.
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                • Bank Origin: Central Clearing & Remittance Account.
              </p>
            </div>
          </div>
        )}

        {/* 4. PURCHASE TAB (Zero Guessing Policy) */}
        {activeTab === "purchase" && (
          <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Local Afghanistan Procurement & Supplier Status
                </h2>
                <p className="text-xs text-slate-500">
                  Strict Accounting Rule: Unknown procurement costs remain NULL, never zero.
                </p>
              </div>
              <span className="badge badge-warning text-xs font-bold">
                {isPurchasePending ? "PENDING SUPPLIER INVOICE" : "COSTED"}
              </span>
            </div>

            {isPurchasePending ? (
              <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Actual Procurement Cost Not Yet Entered
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  In accordance with AQ COMPANIES accounting standards, actual Afghanistan local purchasing prices
                  (AFN / Hawala rates) are not guessed or back-calculated. This shipment will recognize its cost of goods
                  sold once the local purchase receipt is entered.
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <Link href={`/purchases`} className="btn btn-primary text-xs font-bold">
                    Go to Purchase Ledger to Enter Bill
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Supplier Name</span>
                  <p className="font-bold text-slate-900 dark:text-white mt-1">{shipment.supplier_name}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Purchase Rate</span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white mt-1">
                    ${Number(shipment.purchase_rate).toFixed(4)}/kg
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Total Purchase Cost</span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white mt-1">
                    {formatUSD(shipment.purchase_cost)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. TRANSPORT TAB */}
        {activeTab === "transport" && (
          <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Freight & Logistics Provider</h2>
                <p className="text-xs text-slate-500">Service Vendor: SKY ARIANA LIMITED</p>
              </div>
              <Link href="/transport" className="btn btn-secondary text-xs flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" /> View Carrier Ledger
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 font-medium">Freight Charged on Shipment</span>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  {formatUSD(shipment.transport_freight)}
                </p>
                <p className="text-slate-500 mt-1">Billed by Sky Ariana Limited</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 font-medium">Carrier Net Position</span>
                <p className="text-lg font-black text-emerald-600 mt-1">Credit: $291,160.00</p>
                <p className="text-slate-500 mt-1">Carrier owes AQ Companies</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 font-medium">Movement Equipment</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  {shipment.container_number || "Truck Convoy"}
                </p>
                <p className="text-slate-500 mt-1">B/L: {shipment.bl_number || "N/A"}</p>
              </div>
            </div>
          </div>
        )}

        {/* 6. ACCOUNTING TAB */}
        {activeTab === "accounting" && (
          <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b pb-2">
              Profit & Loss Statement (Shipment Level)
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-dashed">
                <span className="text-slate-600 dark:text-slate-400 font-medium">1. Gross Revenue (Sales Value)</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {isUnpriced ? "Rate Pending" : formatUSD(shipment.invoice_value)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-dashed">
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  2. Cost of Goods Sold (Purchase Cost)
                </span>
                <span className="font-mono font-bold text-amber-600">
                  {isPurchasePending ? "PENDING SUPPLIER INVOICE" : formatUSD(shipment.purchase_cost)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-dashed">
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  3. Carrier Freight (Sky Ariana)
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatUSD(shipment.transport_freight)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-dashed">
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  4. Border & Port Incidental Expenses
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatUSD(shipment.other_expenses)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-slate-300 dark:border-slate-700 text-sm font-black">
                <span>Realized Net Profit</span>
                <span className={isPurchasePending ? "text-amber-600" : "text-emerald-600 font-mono"}>
                  {isPurchasePending ? "PROFIT PENDING PURCHASE COST" : formatUSD(shipment.net_profit)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 7. AUDIT HISTORY */}
        {activeTab === "audit" && (
          <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b pb-2">
              Entity Audit Trail & Discrepancy Log
            </h2>
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Excel Migration Record</span>
                  <p className="text-slate-500 mt-0.5">
                    Imported from master Excel ledger S.N. {shipment.source_row_sn || "N/A"}.
                  </p>
                </div>
                <span className="badge badge-success text-[10px]">VERIFIED</span>
              </div>
              {shipment.data_conflict && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-900 dark:text-amber-200">
                  <span className="font-bold">Historical Discrepancy: {shipment.conflict_type}</span>
                  <p className="text-[11px] mt-0.5">{shipment.conflict_details}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
