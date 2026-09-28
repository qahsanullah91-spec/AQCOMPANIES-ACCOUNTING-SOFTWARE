"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Truck,
  Search,
  Filter,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  Ship,
  Phone,
  FileText,
  DollarSign,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { fetchApi, formatUSD, formatWeight, formatNumber } from "@/lib/api";

interface ContainerData {
  container_number: string;
  transit_type?: "OCEAN_CONTAINER" | "TRUCK_TRANSIT" | "PIPELINE_STOCK";
  container_type: string;
  bl_number: string;
  transport_company: string;
  truck_number: string;
  driver_name: string;
  driver_phone: string;
  status: string;
  origin: string;
  route: string;
  destination: string;
  port: string;
  shipment_codes: string[];
  invoices: string[];
  customers: string[];
  products: string[];
  cartons: number;
  net_weight_kg: number;
  cargo_value: number;
  freight: number;
  shipment_date: string;
  detention_free_days: number;
  accrued_detention_usd: number;
}

export default function ContainersPage() {
  const [containers, setContainers] = useState<ContainerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "OCEAN" | "TRUCK" | "PIPELINE">("ALL");
  const [updating, setUpdating] = useState<string | null>(null);

  const loadContainers = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<ContainerData[]>("/containers");
      setContainers(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContainers();
  }, []);

  const handleUpdateStatus = async (cntNum: string, newStatus: string) => {
    try {
      setUpdating(cntNum);
      await fetchApi(`/containers/${encodeURIComponent(cntNum)}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      loadContainers();
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    } finally {
      setUpdating(null);
    }
  };

  const filteredContainers = containers.filter((c) => {
    const matchesSearch =
      c.container_number.toLowerCase().includes(search.toLowerCase()) ||
      c.bl_number.toLowerCase().includes(search.toLowerCase()) ||
      c.transport_company.toLowerCase().includes(search.toLowerCase()) ||
      c.customers.some((cust) => cust.toLowerCase().includes(search.toLowerCase())) ||
      c.invoices.some((inv) => inv.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter ? c.status === statusFilter : true;
    const matchesType =
      typeFilter === "ALL"
        ? true
        : typeFilter === "OCEAN"
        ? c.transit_type === "OCEAN_CONTAINER"
        : typeFilter === "TRUCK"
        ? c.transit_type === "TRUCK_TRANSIT"
        : c.transit_type === "PIPELINE_STOCK";
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalContainers = containers.length;
  const oceanCount = containers.filter((c) => c.transit_type === "OCEAN_CONTAINER").length;
  const truckCount = containers.filter((c) => c.transit_type === "TRUCK_TRANSIT").length;
  const pipelineCount = containers.filter((c) => c.transit_type === "PIPELINE_STOCK").length;
  const inTransitCount = containers.filter((c) => c.status === "IN TRANSIT").length;
  const atPortCount = containers.filter((c) => c.status === "AT PORT" || c.status === "PORT ARRIVED").length;
  const deliveredCount = containers.filter((c) => c.status === "DELIVERED").length;
  const totalCargoValue = containers.reduce((acc, c) => acc + c.cargo_value, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Box className="w-7 h-7 text-sky-600" />
            Container Registry & Real-Time Tracking
          </h1>
          <p className="text-sm text-slate-500">
            Cross-Border Logistics • Chaman Border • Karachi Port • Nhava Sheva / Mundra • Delhi ICD
          </p>
        </div>

        <button
          onClick={loadContainers}
          className="btn btn-secondary flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Tracking
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-white border-l-4 border-l-sky-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Containers</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalContainers}</p>
          <p className="text-xs text-slate-500 mt-1">40ft HQ & 20ft Fleet</p>
        </div>

        <div className="card p-5 bg-white border-l-4 border-l-indigo-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Transit</p>
          <p className="text-2xl font-extrabold text-indigo-600 mt-1">{inTransitCount}</p>
          <p className="text-xs text-slate-500 mt-1">En Route to Indian Ports</p>
        </div>

        <div className="card p-5 bg-white border-l-4 border-l-amber-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">At Port / Customs</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{atPortCount}</p>
          <p className="text-xs text-slate-500 mt-1">Under Clearance / THC</p>
        </div>

        <div className="card p-5 bg-white border-l-4 border-l-emerald-500 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delivered to Buyer</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{deliveredCount}</p>
          <p className="text-xs text-slate-500 mt-1">Consignee Received</p>
        </div>
      </div>

      {/* Fleet Category Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setTypeFilter("ALL")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            typeFilter === "ALL"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          All Fleet Units ({totalContainers})
        </button>
        <button
          onClick={() => setTypeFilter("OCEAN")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            typeFilter === "OCEAN"
              ? "bg-sky-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          🚢 Ocean Containers ({oceanCount})
        </button>
        <button
          onClick={() => setTypeFilter("TRUCK")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            typeFilter === "TRUCK"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          🚛 Border Overland Trucks ({truckCount})
        </button>
        <button
          onClick={() => setTypeFilter("PIPELINE")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            typeFilter === "PIPELINE"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          📦 New Stock Pipeline ({pipelineCount})
        </button>
      </div>

      {/* Search & Status Filter */}
      <div className="card p-4 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search container number, B/L, buyer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-sm w-full font-mono"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select text-sm w-full md:w-60"
          >
            <option value="">All Movement Statuses</option>
            <option value="LOADING">LOADING (Kabul Warehouse)</option>
            <option value="IN TRANSIT">IN TRANSIT (Border / Sea)</option>
            <option value="AT BORDER">AT BORDER (Customs Hold)</option>
            <option value="AT PORT">AT PORT (Nhava Sheva / Mundra)</option>
            <option value="DELIVERED">DELIVERED (Khari Baoli / APMC)</option>
            <option value="CLOSED">CLOSED (Empty Returned)</option>
          </select>
        </div>
      </div>

      {/* Container Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {loading ? (
          <div className="col-span-2 card p-12 text-center text-slate-400">Loading container registry...</div>
        ) : filteredContainers.length === 0 ? (
          <div className="col-span-2 card p-12 text-center text-slate-400">
            No containers found matching current search.
          </div>
        ) : (
          filteredContainers.map((cnt) => {
            const isDelivered = cnt.status === "DELIVERED";
            const isInTransit = cnt.status === "IN TRANSIT";
            const isAtPort = cnt.status === "AT PORT" || cnt.status === "PORT ARRIVED";

            return (
              <div
                key={cnt.container_number}
                className="card p-6 bg-white shadow-sm hover:shadow-md transition-shadow border border-slate-200 space-y-4"
              >
                {/* Top Container Header */}
                <div className="flex items-start justify-between border-b pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-lg font-black text-slate-900 tracking-wider">
                        {cnt.container_number}
                      </span>
                      {cnt.transit_type === "OCEAN_CONTAINER" && (
                        <span className="badge bg-sky-100 text-sky-800 border-sky-200 text-xs font-semibold">
                          🚢 OCEAN 40'HQ
                        </span>
                      )}
                      {cnt.transit_type === "TRUCK_TRANSIT" && (
                        <span className="badge bg-purple-100 text-purple-800 border-purple-200 text-xs font-semibold">
                          🚛 OVERLAND TRUCK
                        </span>
                      )}
                      {cnt.transit_type === "PIPELINE_STOCK" && (
                        <span className="badge bg-amber-100 text-amber-800 border-amber-200 text-xs font-semibold">
                          📦 NEW PIPELINE
                        </span>
                      )}
                      <span className="badge badge-neutral text-xs font-mono">{cnt.container_type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5">
                      <span>B/L: {cnt.bl_number}</span>
                      <span>•</span>
                      <span>Carrier: {cnt.transport_company}</span>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <select
                    value={cnt.status}
                    disabled={updating === cnt.container_number}
                    onChange={(e) => handleUpdateStatus(cnt.container_number, e.target.value)}
                    className={`select text-xs font-bold py-1 px-2.5 rounded-lg border ${
                      isDelivered
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : isInTransit
                        ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                        : isAtPort
                        ? "bg-amber-50 text-amber-700 border-amber-300"
                        : "bg-slate-50 text-slate-700 border-slate-300"
                    }`}
                  >
                    <option value="LOADING">LOADING</option>
                    <option value="IN TRANSIT">IN TRANSIT</option>
                    <option value="AT BORDER">AT BORDER</option>
                    <option value="AT PORT">AT PORT</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                {/* Logistics Route Visualizer */}
                <div className="bg-slate-50 p-3 rounded-lg border text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" /> {cnt.origin}
                    </span>
                    <span className="text-slate-400">➔</span>
                    <span className="flex items-center gap-1 font-mono">{cnt.port}</span>
                    <span className="text-slate-400">➔</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" /> {cnt.destination}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    Corridor: {cnt.route}
                  </div>
                </div>

                {/* Driver & Truck Details */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded border">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Truck & Driver</span>
                    <span className="font-semibold text-slate-800">
                      {cnt.driver_name !== "N/A" ? cnt.driver_name : "Carrier Fleet"}
                    </span>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Truck: {cnt.truck_number !== "N/A" ? cnt.truck_number : "Assigned at Border"}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded border">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Driver Phone</span>
                    <span className="font-mono text-slate-800 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {cnt.driver_phone !== "N/A" ? cnt.driver_phone : "Via Forwarder Dispatch"}
                    </span>
                  </div>
                </div>

                {/* Cargo Details */}
                <div className="pt-2 border-t grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Consignee</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {cnt.customers.join(", ") || "Buyer"}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Volume</span>
                    <span className="font-bold text-slate-900">
                      {formatNumber(cnt.cartons)} CTNS • {formatWeight(cnt.net_weight_kg)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Cargo Value</span>
                    <span className="font-bold text-indigo-700">{formatUSD(cnt.cargo_value)}</span>
                  </div>
                </div>

                {/* Demurrage & Detention Indicator */}
                <div className="p-2.5 bg-sky-50/60 rounded border border-sky-100 flex items-center justify-between text-xs">
                  <span className="text-sky-900 flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-sky-600" />
                    Free Detention Allowance: <b>14 Days</b>
                  </span>
                  <span className="text-emerald-700 font-semibold font-mono text-[11px]">
                    No Detention Incurred
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
