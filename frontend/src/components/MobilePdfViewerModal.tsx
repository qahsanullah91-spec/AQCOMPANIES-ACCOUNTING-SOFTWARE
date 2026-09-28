"use client";

import React, { useState } from "react";
import {
  FileText,
  Download,
  Share2,
  ExternalLink,
  X,
  Maximize2,
  Minimize2,
  RotateCw,
  AlertCircle,
  Printer,
} from "lucide-react";
import { QuickCopy } from "@/components/QuickCopy";

interface MobilePdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title: string;
  referenceCode?: string;
  referenceType?: string;
}

export function MobilePdfViewerModal({
  isOpen,
  onClose,
  pdfUrl,
  title,
  referenceCode,
  referenceType = "Ref #",
}: MobilePdfViewerModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  // iOS Web Share API Integration (Req 30)
  const handleShare = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: `${title} - AQ COMPANIES`,
          text: `${title} (${referenceCode || ""}) - AQ Companies Financial Document`,
          url: pdfUrl.startsWith("http") ? pdfUrl : `${window.location.origin}${pdfUrl}`,
        });
        setShareFeedback("Shared successfully!");
        setTimeout(() => setShareFeedback(null), 2500);
      } else {
        // Fallback: copy link to clipboard
        await navigator.clipboard.writeText(
          pdfUrl.startsWith("http") ? pdfUrl : `${window.location.origin}${pdfUrl}`
        );
        setShareFeedback("Link copied to clipboard!");
        setTimeout(() => setShareFeedback(null), 2500);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.warn("Share failed:", err);
      }
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNative = () => {
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div
        className={`w-full bg-white dark:bg-[#0B0F19] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          isFullscreen
            ? "h-full fixed inset-0 rounded-none z-[60]"
            : "max-h-[94vh] max-h-[94dvh] h-[85vh] sm:max-w-4xl"
        }`}
      >
        {/* Top Header Bar */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {title}
              </h2>
              {referenceCode && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold">{referenceType}:</span>
                  <QuickCopy text={referenceCode} />
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Cluster */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Native iOS Tab / Fullscreen Viewer (Req 29) */}
            <button
              onClick={handleOpenNative}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Open Native iOS Viewer"
              aria-label="Open Native iOS Viewer"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            {/* Share Sheet Button (Req 30) */}
            <button
              onClick={handleShare}
              className="p-2 rounded-xl text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors"
              title="Share PDF (WhatsApp, AirDrop, Files)"
              aria-label="Share PDF"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Direct Download Button */}
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Download PDF"
              aria-label="Download PDF"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="hidden sm:inline-flex p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ml-1"
              aria-label="Close PDF Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Share Feedback Toast */}
        {shareFeedback && (
          <div className="bg-sky-600 text-white text-xs font-semibold px-4 py-1.5 text-center animate-fadeIn">
            {shareFeedback}
          </div>
        )}

        {/* PDF Content Area */}
        <div className="flex-1 relative bg-slate-100 dark:bg-slate-950 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-50 dark:bg-slate-900 z-10">
              <RotateCw className="w-6 h-6 animate-spin text-sky-500" />
              <span className="text-xs font-medium">Loading PDF document...</span>
            </div>
          )}

          {hasError ? (
            /* Safari Fallback Card (Req 29) */
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Direct Safari Preview
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  iOS Safari provides optimal PDF viewing with pinch-to-zoom and AirPrint in its native viewer.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  onClick={handleOpenNative}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in iOS Safari Viewer
                </button>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Download File
                </button>
              </div>
            </div>
          ) : (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full border-none"
              title={title}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          )}
        </div>

        {/* Bottom Bar for Mobile Ergonomics */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-[11px]">AQ Companies Document Engine</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenNative}
              className="text-sky-600 dark:text-sky-400 font-semibold text-[11px] flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Safari Native
            </button>
            <button
              onClick={handleShare}
              className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1"
            >
              <Share2 className="w-3 h-3" />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
