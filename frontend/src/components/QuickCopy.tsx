"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

interface QuickCopyProps {
  text: string;
  label?: string;
  className?: string;
}

export function QuickCopy({ text, label, className = "" }: QuickCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${label || text}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono font-medium transition-all active:scale-95 ${
        copied
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
      } ${className}`}
    >
      <span className="truncate max-w-[140px] sm:max-w-xs">{text}</span>
      {copied ? (
        <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <Check className="w-3 h-3 stroke-[2.5]" />
          <span>Copied!</span>
        </span>
      ) : (
        <Copy className="w-3 h-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0" />
      )}
    </button>
  );
}
