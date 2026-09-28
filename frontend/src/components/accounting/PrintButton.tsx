"use client";

import React, { useState } from "react";
import { Printer, Download, Eye, Share2, Loader2, Check } from "lucide-react";
import { API_BASE } from "@/lib/api";

interface PrintButtonProps {
  label?: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md";
  onBeforePrint?: () => void;
  className?: string;
}

export function PrintButton({
  label = "Print",
  variant = "outline",
  size = "md",
  onBeforePrint,
  className = "",
}: PrintButtonProps) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    try {
      setPrinting(true);
      if (onBeforePrint) onBeforePrint();
      setTimeout(() => {
        window.print();
        setPrinting(false);
      }, 100);
    } catch (e) {
      console.error(e);
      setPrinting(false);
    }
  };

  const variantClasses = {
    primary: "bg-sky-600 hover:bg-sky-700 text-white shadow-xs",
    secondary: "bg-slate-800 hover:bg-slate-900 text-white",
    outline:
      "border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs",
  };

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs font-semibold gap-1.5 min-h-[36px]",
    md: "px-3.5 py-2 text-xs font-bold gap-2 min-h-[44px]",
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={printing}
      className={`no-print inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      title="Print report on A4 paper"
    >
      {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
      <span>{printing ? "Preparing..." : label}</span>
    </button>
  );
}

interface PdfDownloadButtonProps {
  endpoint?: string;
  url?: string;
  filename?: string;
  label?: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  showView?: boolean;
  showShare?: boolean;
  onError?: (err: string) => void;
}

function resolvePdfUrl(targetPath: string): string {
  if (targetPath.startsWith("http")) return targetPath;
  if (typeof window !== "undefined") {
    // In browser, use relative path if it starts with /api or prepend API_BASE
    if (targetPath.startsWith("/api/")) return targetPath;
    if (targetPath.startsWith("/")) return `${API_BASE}${targetPath}`;
    return `${API_BASE}/${targetPath}`;
  }
  return `${process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8000"}${targetPath.startsWith("/") ? "" : "/"}${targetPath}`;
}

export function PdfDownloadButton({
  endpoint,
  url,
  filename = "AQ-Report.pdf",
  label = "Download PDF",
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  showView = false,
  showShare = false,
  onError,
}: PdfDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  const targetPath = url || endpoint || "";

  const fetchPdfBlob = async (): Promise<Blob> => {
    const downloadUrl = resolvePdfUrl(targetPath);
    const res = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        Accept: "application/pdf",
      },
    });

    if (!res.ok) {
      let msg = `Server returned ${res.status}`;
      try {
        const json = await res.json();
        msg = json.detail || msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    return await res.blob();
  };

  const handleDownload = async () => {
    if (!targetPath || disabled) return;
    try {
      setDownloading(true);
      const blob = await fetchPdfBlob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (err: any) {
      console.error(err);
      if (onError) onError(err.message || "Failed to download PDF.");
      else alert(err.message || "Failed to download PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const handleView = async () => {
    if (!targetPath || disabled) return;
    try {
      setViewing(true);
      const blob = await fetchPdfBlob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch (err: any) {
      console.error(err);
      if (onError) onError(err.message || "Failed to open PDF.");
      else alert(err.message || "Failed to open PDF.");
    } finally {
      setViewing(false);
    }
  };

  const handleShare = async () => {
    if (!targetPath || disabled) return;
    try {
      setSharing(true);
      const blob = await fetchPdfBlob();
      const file = new File([blob], filename, { type: "application/pdf" });

      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: filename,
          text: `AQ COMPANIES — ${filename}`,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      } else if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: filename,
          url: resolvePdfUrl(targetPath),
        });
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      } else {
        // Fallback to direct download
        handleDownload();
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error(err);
        handleDownload();
      }
    } finally {
      setSharing(false);
    }
  };

  const variantClasses = {
    primary: "bg-sky-600 hover:bg-sky-700 text-white shadow-xs font-bold",
    secondary: "bg-slate-800 hover:bg-slate-900 text-white font-bold",
    outline:
      "border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs font-semibold",
  };

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs gap-1.5 min-h-[36px]",
    md: "px-3.5 py-2 text-xs gap-2 min-h-[44px]",
  };

  return (
    <div className="inline-flex items-center gap-1.5 no-print">
      {/* Primary Download Button */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading || disabled || !targetPath}
        className={`inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        title="Download authoritative PDF from server"
      >
        {downloading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span>{downloading ? "Generating PDF..." : label}</span>
      </button>

      {/* Optional Safari View Button */}
      {showView && (
        <button
          type="button"
          onClick={handleView}
          disabled={viewing || disabled || !targetPath}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 text-xs font-semibold min-h-[44px] min-w-[44px]"
          title="View PDF directly in browser"
          aria-label="View PDF"
        >
          {viewing ? (
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
          ) : (
            <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          )}
        </button>
      )}

      {/* Optional iOS Share Button */}
      {showShare && (
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing || disabled || !targetPath}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 text-xs font-semibold min-h-[44px] min-w-[44px]"
          title="Share PDF via iOS Share Sheet"
          aria-label="Share PDF"
        >
          {sharing ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          ) : shared ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <Share2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Mobile-first comprehensive PDF actions group (View, Download, Share)
 */
export function MobilePdfActions({
  url,
  filename = "AQ-Report.pdf",
  className = "",
}: {
  url: string;
  filename?: string;
  className?: string;
}) {
  return (
    <PdfDownloadButton
      url={url}
      filename={filename}
      label="PDF"
      showView={true}
      showShare={true}
      variant="outline"
      size="sm"
      className={className}
    />
  );
}
