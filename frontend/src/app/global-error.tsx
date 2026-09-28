"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("AQ Companies Critical Global Exception:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 flex items-center justify-center min-h-screen p-6 font-sans antialiased">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-950/80 text-rose-400 mx-auto flex items-center justify-center border border-rose-900">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black tracking-tight text-white">
              Application System Exception
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              AQ Companies encountered an unexpected client-side exception while loading the view. Database records are fully protected.
            </p>
            {error?.digest && (
              <p className="text-[11px] font-mono text-slate-500">
                Request ID: {error.digest}
              </p>
            )}
          </div>

          <div>
            <button
              onClick={() => reset()}
              className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-sky-600/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
