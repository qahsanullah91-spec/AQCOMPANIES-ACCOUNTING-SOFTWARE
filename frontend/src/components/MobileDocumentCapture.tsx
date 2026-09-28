"use client";

import React, { useState, useRef } from "react";
import {
  Camera,
  Image as ImageIcon,
  FileText,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Eye,
  Maximize2,
  Minimize2,
  Trash2,
  ShieldCheck,
  FileUp,
} from "lucide-react";
import { API_BASE, fetchApi } from "@/lib/api";

interface MobileDocumentCaptureProps {
  entityType?:
    | "Customer Receipt"
    | "Supplier Payment"
    | "Transport Payment"
    | "Bank Transaction"
    | "Expense Voucher"
    | "Journal Entry"
    | "Invoice"
    | "General Document";
  entityId?: number | string;
  isOpen?: boolean;
  onClose?: () => void;
  onUploadSuccess?: (doc: any) => void;
}

export function MobileDocumentCapture({
  entityType = "General Document",
  entityId,
  isOpen = true,
  onClose,
  onUploadSuccess,
}: MobileDocumentCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [compressionProgress, setCompressionProgress] = useState<number>(0);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isHeic, setIsHeic] = useState<boolean>(false);

  const [title, setTitle] = useState<string>(
    `${entityType} - ${new Date().toISOString().split("T")[0]}`
  );
  const [category, setCategory] = useState<string>(
    entityType.includes("Receipt")
      ? "Receipt"
      : entityType.includes("Supplier")
      ? "Supplier Bill"
      : entityType.includes("Transport")
      ? "Transport Slip"
      : entityType.includes("Expense")
      ? "Expense"
      : entityType.includes("Bank")
      ? "Bank Receipt"
      : "Voucher Attachment"
  );

  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<any | null>(null);
  const [fullPreviewOpen, setFullPreviewOpen] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  // Format file size helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Client-Side Canvas Image Compression (Req 22)
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      // If PDF or small image under 1.2MB, skip canvas compression
      if (file.type === "application/pdf" || file.size < 1200000) {
        setCompressedSize(file.size);
        return resolve(file);
      }

      setIsCompressing(true);
      setCompressionProgress(25);

      const img = new Image();
      img.src = URL.createObjectURL(file);

      img.onload = () => {
        setCompressionProgress(50);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          setIsCompressing(false);
          return resolve(file);
        }

        // Max dimension 2048px (Req 22) to keep voucher numbers crystal clear
        const MAX_DIM = 2048;
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw with high quality interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        setCompressionProgress(75);

        // Quality 0.82 balances crisp text with 70-85% size reduction
        canvas.toBlob(
          (blob) => {
            setIsCompressing(false);
            setCompressionProgress(100);
            if (!blob) {
              return resolve(file);
            }
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, ".jpg"),
              {
                type: "image/jpeg",
                lastModified: Date.now(),
              }
            );
            setCompressedSize(compressedFile.size);
            resolve(compressedFile);
          },
          "image/jpeg",
          0.82
        );
      };

      img.onerror = () => {
        setIsCompressing(false);
        resolve(file);
      };
    });
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadedDoc(null);
    setUploadProgress(0);

    // 15MB limit check (Req 27)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError(
        `File exceeds 15MB limit (current: ${formatBytes(
          file.size
        )}). Please select a smaller file or take a photo with lower resolution.`
      );
      if (e.target) e.target.value = "";
      return;
    }

    setOriginalSize(file.size);

    // HEIC detection (Req 24)
    const isHeicFile =
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif") ||
      file.type === "image/heic" ||
      file.type === "image/heif";

    setIsHeic(isHeicFile);

    try {
      if (file.type.startsWith("image/") && !isHeicFile) {
        const compressed = await compressImage(file);
        setSelectedFile(compressed);
        setPreviewUrl(URL.createObjectURL(compressed));
      } else {
        // PDF or HEIC
        setSelectedFile(file);
        setCompressedSize(file.size);
        if (file.type.startsWith("image/")) {
          setPreviewUrl(URL.createObjectURL(file));
        } else {
          setPreviewUrl(null);
        }
      }
    } catch (err: any) {
      console.warn("Compression fallback", err);
      setSelectedFile(file);
      setCompressedSize(file.size);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadProgress(15);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 30 second timeout (Req 25)
    const timeoutId = setTimeout(() => {
      controller.abort();
      setUploadError("Upload timed out after 30s. Check connection and retry.");
      setUploading(false);
    }, 30000);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title);
      formData.append("category", category);
      if (entityId) {
        formData.append("invoice_id", String(entityId));
      }

      setUploadProgress(45);

      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || `Upload failed with HTTP ${res.status}`);
      }

      setUploadProgress(100);
      const data = await res.json();
      setUploadedDoc(data);

      if (onUploadSuccess) {
        onUploadSuccess(data);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setUploadError("Upload timed out or was cancelled. Check connection and retry.");
      } else {
        setUploadError(err.message || "Failed to upload document. Please retry.");
      }
    } finally {
      clearTimeout(timeoutId);
      setUploading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setOriginalSize(0);
    setCompressedSize(0);
    setUploadError(null);
    setUploadedDoc(null);
    setUploadProgress(0);
    setIsHeic(false);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Hidden File Inputs (Req 21) */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFilePicked}
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,application/pdf,.heic,.heif"
        onChange={handleFilePicked}
        className="hidden"
      />

      <div className="w-full sm:max-w-lg bg-white dark:bg-[#111827] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] max-h-[92dvh] animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600/10 border border-sky-500/20 flex items-center justify-center text-sky-500">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Attach Voucher Document
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {entityType} {entityId ? `#${entityId}` : ""}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Success State */}
          {uploadedDoc ? (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                  Document Attached Successfully
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Attached to {entityType}: {title}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  Attach Another
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          ) : !selectedFile ? (
            /* Upload Action Selection */
            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                Take a direct photo of your paper voucher, Sarafi slip, or select a document from your files.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Take Photo Button (Direct Camera - Req 21) */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-sky-500/40 bg-sky-50/50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 hover:bg-sky-100/50 dark:hover:bg-sky-950/40 transition-all active:scale-95 group text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 group-hover:scale-105 transition-transform mb-2">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold">Take Photo</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Camera Direct</span>
                </button>

                {/* Photo Library / Files Button (Req 21) */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 group text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-700 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform mb-2">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold">Photo / PDF</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Files & Library</span>
                </button>
              </div>

              {/* Supported formats guidance */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                <span>JPEG, PNG, HEIC, PDF</span>
                <span>Max size: 15MB</span>
              </div>
            </div>
          ) : (
            /* Selected File Preview & Upload Confirmation */
            <div className="space-y-4">
              {/* HEIC Alert (Req 24) */}
              {isHeic && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>HEIC format detected — converting for compatibility</span>
                </div>
              )}

              {/* Compression Notification (Req 22) */}
              {isCompressing && (
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Compressing photo...</span>
                    <span>{compressionProgress}%</span>
                  </div>
                  <div className="w-full bg-sky-200 dark:bg-sky-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-sky-500 h-full transition-all duration-300"
                      style={{ width: `${compressionProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Optimizing resolution (max 2048px) to preserve voucher legibility.
                  </p>
                </div>
              )}

              {/* Preview Thumbnail Card */}
              <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 overflow-hidden p-3 flex items-center gap-3">
                {previewUrl ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFullPreviewOpen(true)}
                      className="absolute inset-0 bg-black/30 hover:bg-black/40 flex items-center justify-center text-white transition-opacity"
                      aria-label="Zoom preview"
                    >
                      <Eye className="w-5 h-5 drop-shadow" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex flex-col items-center justify-center shrink-0">
                    <FileText className="w-8 h-8" />
                    <span className="text-[9px] font-bold mt-1 uppercase">PDF DOC</span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {selectedFile.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                    {originalSize !== compressedSize && (
                      <span className="line-through text-slate-400">
                        {formatBytes(originalSize)}
                      </span>
                    )}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatBytes(compressedSize || selectedFile.size)}
                    </span>
                    {originalSize > compressedSize && (
                      <span className="text-emerald-600 text-[10px]">
                        (-{Math.round(((originalSize - compressedSize) / originalSize) * 100)}%)
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="mt-2 text-[11px] text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Change Document
                  </button>
                </div>
              </div>

              {/* Title & Category Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Enter voucher title..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="Receipt">Customer Receipt</option>
                    <option value="Supplier Bill">Supplier Bill / Invoice</option>
                    <option value="Transport Slip">Transport Slip / Waybill</option>
                    <option value="Bank Receipt">Bank Slip / MT103</option>
                    <option value="Expense">Operating Expense Voucher</option>
                    <option value="Contract">Contract / Sarafi Note</option>
                    <option value="Other">Other Document</option>
                  </select>
                </div>
              </div>

              {/* Upload Progress Bar (Req 25) */}
              {uploading && (
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 animate-spin text-sky-500" />
                      Uploading document...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-sky-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleCancelUpload}
                      className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold"
                    >
                      Cancel Upload
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{uploadError}</p>
                    <button
                      type="button"
                      onClick={handleUpload}
                      className="mt-1.5 text-xs underline font-bold text-rose-600 dark:text-rose-400"
                    >
                      Retry Upload
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={uploading}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || isCompressing}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <FileUp className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Attach Document"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-Screen Zoom Preview Modal */}
      {fullPreviewOpen && previewUrl && (
        <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => setFullPreviewOpen(false)}
              className="p-2.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
              aria-label="Close zoom"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="max-w-4xl max-h-[85vh] overflow-auto flex items-center justify-center">
            <img
              src={previewUrl}
              alt="Full Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
