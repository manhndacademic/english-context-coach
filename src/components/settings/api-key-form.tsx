"use client";

import { useState } from "react";
import { saveUserApiKeyAction } from "@/app/actions/settings";
import {
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface ApiKeyFormProps {
  initialHasCustomKey: boolean;
}

export function ApiKeyForm({ initialHasCustomKey }: ApiKeyFormProps) {
  const [hasKey, setHasKey] = useState(initialHasCustomKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const keyVal = formData.get("apiKey") as string;

    try {
      const result = await saveUserApiKeyAction(null, formData);
      if (result && "error" in result) {
        setError(result.error as string);
      } else {
        setSuccess(true);
        if (keyVal.trim() === "") {
          setHasKey(false);
        } else {
          setHasKey(true);
        }
        // Clear input field
        const input = e.currentTarget.querySelector(
          "#apiKey"
        ) as HTMLInputElement;
        if (input) input.value = "";
      }
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi không xác định.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-6">
      <div className="flex items-start gap-4 flex-col sm:flex-row border-b border-border pb-5">
        <div className="bg-accent-light text-accent p-3 rounded-md shrink-0">
          <KeyRound size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-serif mb-1.5 text-text m-0">
            Cấu hình API Key cá nhân
          </h1>
          <p className="text-muted text-sm leading-relaxed m-0">
            Nhập API Key của riêng bạn từ Google AI Studio để tránh giới hạn
            lượt dùng chung của hệ thống.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="grid gap-2">
          <label htmlFor="apiKey" className="text-sm font-semibold text-text">
            Google Gemini API Key
          </label>
          <div className="relative flex items-center">
            <input
              type="password"
              id="apiKey"
              name="apiKey"
              placeholder={
                hasKey
                  ? "••••••••••••••••••••••••••••••••"
                  : "Nhập API Key của bạn (AIzaSy...)"
              }
              disabled={loading}
              className="w-full min-h-11 px-3.5 pr-10 rounded-md border border-border bg-background text-text text-sm transition-all focus:border-accent focus:outline-none disabled:opacity-60"
            />
            {loading && (
              <span className="absolute right-3.5 text-muted animate-spin">
                <Loader2 size={18} />
              </span>
            )}
          </div>

          {error && (
            <span className="text-danger text-xs flex items-start gap-1.5 font-medium mt-1">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </span>
          )}

          {success && (
            <span className="text-success text-xs flex items-center gap-1.5 font-medium mt-1">
              <CheckCircle2 size={14} /> Lưu cấu hình thành công!
            </span>
          )}

          {hasKey && !error && !success && (
            <span className="text-success text-xs flex items-center gap-1.5 font-medium mt-1">
              <ShieldCheck size={14} /> Bạn đã cấu hình API Key cá nhân. Nhập
              key mới để thay đổi hoặc bỏ trống và lưu để xóa key.
            </span>
          )}

          {!hasKey && !error && !success && (
            <span className="text-muted text-xs flex items-center gap-1.5 mt-1">
              <AlertCircle size={14} /> Bạn có thể lấy API Key miễn phí từ{" "}
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline font-semibold"
              >
                Google AI Studio
              </a>
              .
            </span>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-6 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
          >
            {loading ? "Đang xác thực & lưu..." : "Lưu cấu hình"}
          </button>
        </div>
      </form>
    </section>
  );
}
