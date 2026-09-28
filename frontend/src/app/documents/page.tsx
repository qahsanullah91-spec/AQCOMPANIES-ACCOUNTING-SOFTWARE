"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  Upload,
  Search,
  Download,
  AlertTriangle,
  CheckCircle,
  Eye,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import { fetchApi, formatUSD, formatWeight, formatRate, formatNumber, API_BASE } from "@/lib/api";

interface DocumentItem {
  id: number;
  title: string;
  category: string;
  filename: string;
  mime_type: string;
  file_size: number;
  shipment_id?: number;
  invoice_id?: number;
  uploaded_by: string;
  uploaded_at: string;
}

interface ExtractionResult {
  filename: string;
  file_path: string;
  confidence_score: number;
  duplicate_warnings: string[];
  raw_text_snippet: string;
  extracted_data: {
    invoice_number: string;
    container_number: string;
    bl_number: string;
    net_weight_kg: number;
    gross_weight_kg: number;
    cartons: number;
    rate_per_kg: number;
    customer_id?: number;
    customer_name?: string;
    date: string;
  };
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<DocumentItem[]>("/documents");
      setDocuments(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setErrorMsg("");
      setSuccessMsg("");
      setExtraction(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/documents/extract-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Extraction failed: ${res.statusText}`);
      }

      const result: ExtractionResult = await res.json();
      setExtraction(result);
      loadDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process PDF document");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateShipmentFromExtracted = async () => {
    if (!extraction) return;
    try {
      setUploading(true);
      const ext = extraction.extracted_data;
      await fetchApi("/shipments", {
        method: "POST",
        body: JSON.stringify({
          invoice_number: ext.invoice_number || `INV-${Date.now()}`,
          container_number: ext.container_number || undefined,
          bl_number: ext.bl_number || undefined,
          customer_id: ext.customer_id || 1,
          product_summary: "Dry Fruit (Extracted from Document)",
          cartons: ext.cartons || 1000,
          packages: ext.cartons || 1000,
          net_weight_kg: ext.net_weight_kg || 10000,
          gross_weight_kg: ext.gross_weight_kg || ext.net_weight_kg || 10000,
          rate_per_kg: ext.rate_per_kg || 5.0,
          purchase_rate: (ext.rate_per_kg || 5.0) * 0.7,
          transport_freight: 5000.0,
          status: "IN TRANSIT",
        }),
      });
      setSuccessMsg("Successfully created new Shipment ledger entry from verified document!");
      setExtraction(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to convert extracted data to shipment");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileText className="w-7 h-7 text-indigo-600" />
          Document Vault & Intelligent PDF Extractor
        </h1>
        <p className="text-sm text-slate-500">
          Upload Commercial Invoices, Bills of Lading, Phytosanitary Certificates • Automated OCR Extraction
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 text-sm font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-700" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          {errorMsg}
        </div>
      )}

      {/* Upload & Extraction Dropzone */}
      <div className="card p-8 bg-gradient-to-br from-indigo-50/70 to-slate-50 border-2 border-dashed border-indigo-200 text-center space-y-4 rounded-2xl shadow-sm">
        <div className="w-14 h-14 mx-auto rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-inner">
          {uploading ? (
            <RefreshCw className="w-7 h-7 animate-spin" />
          ) : (
            <Upload className="w-7 h-7" />
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900">
            {uploading ? "Analyzing Document with Heuristic Parser..." : "Upload Shipping or Export Document"}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Accepts PDF Commercial Invoices, Bills of Lading (B/L), Camera Photos, Phytosanitary Certificates.
            Automatically parses invoice number, container number, weights, rates, and checks for duplicates.
          </p>
        </div>

        <label className="btn btn-primary cursor-pointer inline-flex items-center justify-center gap-2 text-xs font-semibold px-5 py-2.5 min-h-[44px]">
          <Sparkles className="w-4 h-4" />
          <span>Select Document, Photo, or Camera</span>
          <input
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleFileUpload}
          />
        </label>
      </div>

      {/* Intelligent Extraction Review Card */}
      {extraction && (
        <div className="card p-6 bg-white border-2 border-indigo-500 shadow-xl space-y-5 rounded-2xl">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                <FileCheck className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Extracted Fields Review</h3>
                <p className="text-xs text-slate-500 font-mono">{extraction.filename}</p>
              </div>
            </div>

            <span className="badge badge-success text-xs font-bold px-3 py-1">
              Confidence: {Math.round(extraction.confidence_score * 100)}%
            </span>
          </div>

          {/* Duplicate Warnings Banner */}
          {extraction.duplicate_warnings && extraction.duplicate_warnings.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Duplicate Detection Warnings:
              </p>
              {extraction.duplicate_warnings.map((w, idx) => (
                <p key={idx} className="text-xs text-amber-800 pl-5">
                  • {w}
                </p>
              ))}
            </div>
          )}

          {/* Form Fields for Review */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Invoice Number</span>
              <span className="text-base font-black text-slate-900 font-mono">
                {extraction.extracted_data.invoice_number || "Not detected"}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Container Number</span>
              <span className="text-base font-black text-sky-700 font-mono">
                {extraction.extracted_data.container_number || "Not detected"}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Bill of Lading (B/L)</span>
              <span className="text-base font-black text-slate-900 font-mono">
                {extraction.extracted_data.bl_number || "Not detected"}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Matched Buyer</span>
              <span className="text-sm font-bold text-slate-900">
                {extraction.extracted_data.customer_name || "Auto-match pending"}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Packages / Cartons</span>
              <span className="text-base font-black text-slate-900">
                {formatNumber(extraction.extracted_data.cartons)} CTNS
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Net Weight (KG)</span>
              <span className="text-base font-black text-slate-900">
                {formatWeight(extraction.extracted_data.net_weight_kg)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Detected Unit Rate</span>
              <span className="text-base font-black text-slate-900">
                {formatRate(extraction.extracted_data.rate_per_kg)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Estimated Sales Value</span>
              <span className="text-base font-black text-indigo-700">
                {formatUSD(
                  (extraction.extracted_data.net_weight_kg || 0) *
                    (extraction.extracted_data.rate_per_kg || 0)
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <button
              onClick={() => setExtraction(null)}
              className="btn btn-secondary text-xs"
            >
              Dismiss
            </button>

            <button
              onClick={handleCreateShipmentFromExtracted}
              disabled={uploading}
              className="btn btn-primary text-xs flex items-center gap-2 font-bold px-5"
            >
              <ArrowRight className="w-4 h-4" />
              1-Click Convert into Shipment Ledger
            </button>
          </div>
        </div>
      )}

      {/* Document Archive Table */}
      <div className="card overflow-hidden bg-white shadow-sm space-y-3">
        <div className="p-4 border-b">
          <h3 className="text-base font-bold text-slate-900">Document Repository Archive</h3>
          <p className="text-xs text-slate-500">Secure digital archive of verified shipping documentation</p>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Document Title</th>
                <th>Category</th>
                <th>Filename</th>
                <th>File Size</th>
                <th>Uploaded Date</th>
                <th className="text-center">Download</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Loading archived documents...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No documents uploaded yet. Upload your first PDF above.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      {doc.title || doc.filename}
                    </td>
                    <td>
                      <span className="badge badge-neutral text-xs">{doc.category}</span>
                    </td>
                    <td className="text-xs text-slate-500 font-mono">{doc.filename}</td>
                    <td className="text-xs text-slate-500">
                      {Math.round(doc.file_size / 1024)} KB
                    </td>
                    <td className="text-xs text-slate-500">{doc.uploaded_at?.split("T")[0]}</td>
                    <td className="text-center">
                      <a
                        href={`${API_BASE}/documents/${doc.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary py-1 px-3 text-xs inline-flex items-center gap-1 font-semibold text-indigo-700"
                      >
                        <Download className="w-3.5 h-3.5" /> Get File
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
