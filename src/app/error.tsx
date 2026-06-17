"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Log the error to an error reporting service if available
    console.error("Unhandled frontend boundary error:", error);
  }, [error]);

  const handleCopyDiagnostics = () => {
    const diagnosticText = `[ENGLISH CONTEXT COACH - CRITICAL ERROR]
Error Message: ${error.message || "Unknown error"}
Error Digest: ${error.digest || "N/A"}
Stack Trace: ${error.stack || "N/A"}
Timestamp: ${new Date().toISOString()}`;

    navigator.clipboard.writeText(diagnosticText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isApiKeyOrQuotaError =
    error.message?.includes("API key") ||
    error.message?.includes("quota") ||
    error.message?.includes("rate limit") ||
    error.message?.includes("RESOURCE_EXHAUSTED") ||
    error.message?.includes("keys available");

  return (
    <div className="min-h-screen bg-background text-text flex items-center justify-center p-6 select-none">
      <main className="max-w-md w-full bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-xl flex flex-col gap-6 transition-all duration-200">
        <div className="flex justify-center">
          <div className="bg-danger-light text-danger p-4 rounded-full border border-danger/15 w-16 h-16 flex items-center justify-center animate-pulse shadow-md">
            <AlertTriangle size={32} />
          </div>
        </div>

        <div className="text-center grid gap-2">
          <h1 className="text-2xl font-bold font-serif text-text m-0">
            {isApiKeyOrQuotaError ? "Gián đoạn kết nối AI" : "Đã xảy ra sự cố"}
          </h1>
          <p className="text-muted text-sm leading-relaxed m-0 mt-1">
            {isApiKeyOrQuotaError
              ? "Hệ thống gặp khó khăn khi kết nối với máy chủ AI (có thể do hết hạn ngạch hoặc lỗi API Key). Vui lòng thử lại sau vài giây hoặc báo lại quản trị viên."
              : "Ứng dụng gặp một lỗi không mong đợi khi đang xử lý yêu cầu của bạn. Chúng tôi xin lỗi vì sự bất tiện này."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button
            onClick={() => reset()}
            className="flex-1 h-11 font-semibold text-sm bg-accent hover:bg-accent-hover text-white transition-all shadow-[0_4px_12px_rgba(5,150,105,0.15)] hover:-translate-y-px rounded-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw size={15} /> Thử tải lại trang
          </Button>
          <Link href="/dashboard" className="flex-1" passHref>
            <Button
              variant="secondary"
              className="w-full h-11 font-semibold text-sm transition-all hover:-translate-y-px rounded-lg flex items-center justify-center gap-2"
            >
              <Home size={15} /> Bảng điều khiển
            </Button>
          </Link>
        </div>

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
                {error.message || "Unknown unexpected system failure."}
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
                    <Copy size={13} /> Sao chép chẩn đoán gửi admin
                  </>
                )}
              </Button>
            </div>
          </details>
        </div>
      </main>
    </div>
  );
}
