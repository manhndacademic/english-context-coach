"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error("Unhandled global root layout error:", error);
  }, [error]);

  const handleCopyDiagnostics = () => {
    const diagnosticText = `[ENGLISH CONTEXT COACH - GLOBAL ERROR]
Error Message: ${error.message || "Unknown error"}
Error Digest: ${error.digest || "N/A"}
Stack Trace: ${error.stack || "N/A"}
Timestamp: ${new Date().toISOString()}`;

    navigator.clipboard.writeText(diagnosticText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <html lang="vi">
      <body>
        <div className="min-h-screen bg-background text-text flex items-center justify-center p-6 select-none">
          <main className="max-w-md w-full bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-xl flex flex-col gap-6 transition-all duration-200">
            <div className="flex justify-center">
              <div className="bg-danger-light text-danger p-4 rounded-full border border-danger/15 w-16 h-16 flex items-center justify-center animate-pulse shadow-md">
                <AlertTriangle size={32} />
              </div>
            </div>

            <div className="text-center grid gap-2">
              <h1 className="text-2xl font-bold font-serif text-text m-0">
                Lỗi hệ thống nghiêm trọng
              </h1>
              <p className="text-muted text-sm leading-relaxed m-0 mt-1">
                Ứng dụng gặp sự cố nghiêm trọng từ cấu trúc giao diện chính. Vui
                lòng thử tải lại trang hoặc liên hệ quản trị viên để được hỗ
                trợ.
              </p>
            </div>

            <Button
              onClick={() => reset()}
              className="w-full h-11 font-semibold text-sm bg-accent hover:bg-accent-hover text-white transition-all shadow-[0_4px_12px_rgba(5,150,105,0.15)] hover:-translate-y-px rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={15} /> Thử tải lại trang
            </Button>

            <div className="border-t border-border pt-4">
              <details className="group cursor-pointer">
                <summary className="text-[11px] font-bold uppercase tracking-wider text-muted hover:text-text list-none flex items-center justify-between transition-colors">
                  <span>Thông tin chẩn đoán lỗi</span>
                  <span className="text-xs transition-transform group-open:rotate-180">
                    ▼
                  </span>
                </summary>
                <div className="mt-3 grid gap-3">
                  <div className="bg-background border border-border p-3.5 rounded-lg text-xs font-mono text-danger whitespace-pre-wrap max-h-40 overflow-y-auto shadow-inner text-left select-text">
                    <span className="block text-muted font-bold text-[10px] uppercase tracking-wider mb-1.5">
                      Chi tiết lỗi:
                    </span>
                    {error.message || "Unknown root layout failure."}
                    {error.digest && (
                      <span className="block mt-2 text-muted">
                        Digest: {error.digest}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyDiagnostics}
                    className="w-full h-9 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check size={13} className="text-success" /> Đã sao chép
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Sao chép chẩn đoán
                      </>
                    )}
                  </Button>
                </div>
              </details>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
