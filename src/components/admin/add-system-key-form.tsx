"use client";

import { useRef, useState, useTransition } from "react";
import { addSystemApiKeyAction } from "@/app/actions/admin-keys";
import { AlertCircle, CheckCircle2, Loader2, Plus } from "lucide-react";

export function AddSystemKeyForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  return (
    <section className="bg-surface border border-border rounded-lg p-5 sm:p-6 shadow-sm grid gap-4">
      <h2 className="text-lg font-bold text-text flex items-center gap-2 m-0">
        <Plus size={18} className="text-accent" /> Thêm API Key mới vào hệ thống
      </h2>
      {message && (
        <div
          className={`text-sm flex gap-2 rounded-md border p-3 ${message.type === "success" ? "text-success-strong border-success bg-success-light" : "text-danger-strong border-danger bg-danger-light"}`}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {message.text}
        </div>
      )}
      <form
        ref={formRef}
        action={(formData) => {
          setMessage(null);
          startTransition(async () => {
            const result = await addSystemApiKeyAction(null, formData);
            if (result?.error)
              setMessage({ type: "error", text: result.error });
            else {
              setMessage({
                type: "success",
                text: "Đã xác thực và thêm key hệ thống.",
              });
              formRef.current?.reset();
            }
          });
        }}
        className="grid grid-cols-1 sm:grid-cols-[1.5fr_2fr_1fr_auto] gap-3 items-end"
      >
        <div className="grid gap-1">
          <label
            htmlFor="name"
            className="text-xs font-bold text-muted uppercase"
          >
            Tên gợi nhớ
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            placeholder="Ví dụ: Gemini Studio Key 1"
            className="min-h-10 px-3 rounded-md border border-border bg-background text-text text-sm"
          />
        </div>
        <div className="grid gap-1">
          <label
            htmlFor="apiKey"
            className="text-xs font-bold text-muted uppercase"
          >
            Google AI Studio API Key
          </label>
          <input
            type="password"
            id="apiKey"
            name="apiKey"
            required
            placeholder="AIzaSy..."
            className="min-h-10 px-3 rounded-md border border-border bg-background text-text text-sm"
          />
        </div>
        <div className="grid gap-1">
          <label
            htmlFor="provider"
            className="text-xs font-bold text-muted uppercase"
          >
            Nhà cung cấp
          </label>
          <select
            id="provider"
            name="provider"
            className="min-h-10 px-3 rounded-md border border-border bg-background text-text text-sm"
          >
            <option value="gemini">Google Gemini</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 min-h-10 rounded-md border border-transparent px-5 font-semibold text-sm bg-accent text-white disabled:opacity-60"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />} Thêm Key
        </button>
      </form>
    </section>
  );
}
