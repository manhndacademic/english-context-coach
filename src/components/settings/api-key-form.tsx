"use client";

import { useRef, useState, useTransition } from "react";
import {
  addUserApiKeyAction,
  deleteUserApiKeyAction,
  disableUserApiKeyAction,
  enableUserApiKeyAction,
  reverifyUserApiKeyAction,
} from "@/app/actions/settings";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
  RefreshCw,
  Power,
  PowerOff,
} from "lucide-react";

export interface UserApiKeyListItem {
  id: string;
  name: string;
  provider: string;
  status: string;
  errorMessage: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

interface ApiKeyFormProps {
  keys: UserApiKeyListItem[];
  legacyHasCustomKey: boolean;
}

function badgeClass(status: string) {
  if (status === "active")
    return "bg-success text-white dark:text-background border-transparent";
  if (status === "rate_limited")
    return "bg-warning text-white dark:text-background border-transparent";
  if (status === "invalid")
    return "bg-danger text-white dark:text-background border-transparent";
  return "bg-background border-border text-muted";
}

function formatDate(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleDateString("vi-VN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApiKeyForm({ keys, legacyHasCustomKey }: ApiKeyFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function submitAction(
    action: (prev: unknown, formData: FormData) => Promise<any>,
    formData: FormData,
    successText: string
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action(null, formData);
      if (result?.error) setMessage({ type: "error", text: result.error });
      else {
        setMessage({ type: "success", text: successText });
        formRef.current?.reset();
      }
    });
  }

  return (
    <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-6">
      <div className="flex items-start gap-4 flex-col sm:flex-row border-b border-border pb-5">
        <div className="bg-accent-light text-accent-strong p-3 rounded-md shrink-0">
          <KeyRound size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-serif mb-1.5 text-text m-0">
            API Key cá nhân
          </h1>
          <p className="text-muted text-sm leading-relaxed m-0">
            Lưu nhiều Gemini API keys riêng, xoay vòng tự động trước khi dùng
            key hệ thống.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`text-sm flex items-start gap-2 rounded-md border p-3 ${message.type === "success" ? "text-success-strong border-success bg-success-light" : "text-danger-strong border-danger bg-danger-light"}`}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-background text-muted text-xs uppercase">
            <tr>
              <th className="p-3">Tên</th>
              <th className="p-3">Provider</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Dùng gần nhất</th>
              <th className="p-3">Tạo lúc</th>
              <th className="p-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {keys.map((key) => (
              <tr key={key.id}>
                <td className="p-3 font-semibold text-text">{key.name}</td>
                <td className="p-3 text-muted">{key.provider}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${badgeClass(key.status)}`}
                  >
                    {key.status}
                  </span>
                </td>
                <td className="p-3 text-muted text-xs">
                  {formatDate(key.lastUsedAt)}
                </td>
                <td className="p-3 text-muted text-xs">
                  {formatDate(key.createdAt)}
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-2">
                    <form
                      action={(fd) =>
                        submitAction(
                          reverifyUserApiKeyAction,
                          fd,
                          "Đã xác thực lại key."
                        )
                      }
                    >
                      <input type="hidden" name="keyId" value={key.id} />
                      <button
                        className="p-1.5 border border-border rounded-md text-accent"
                        title="Xác thực lại"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </form>
                    {key.status === "disabled" ? (
                      <form
                        action={(fd) =>
                          submitAction(
                            enableUserApiKeyAction,
                            fd,
                            "Đã bật key."
                          )
                        }
                      >
                        <input type="hidden" name="keyId" value={key.id} />
                        <button
                          className="p-1.5 border border-border rounded-md text-success"
                          title="Bật"
                        >
                          <Power size={14} />
                        </button>
                      </form>
                    ) : (
                      <form
                        action={(fd) =>
                          submitAction(
                            disableUserApiKeyAction,
                            fd,
                            "Đã tắt key."
                          )
                        }
                      >
                        <input type="hidden" name="keyId" value={key.id} />
                        <button
                          className="p-1.5 border border-border rounded-md text-warning-strong"
                          title="Tắt"
                        >
                          <PowerOff size={14} />
                        </button>
                      </form>
                    )}
                    <form
                      onSubmit={(e) => {
                        if (
                          !confirm(
                            "Bạn có chắc chắn muốn xóa API Key này không? Hành động này không thể hoàn tác."
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                      action={(fd) =>
                        submitAction(deleteUserApiKeyAction, fd, "Đã xóa key.")
                      }
                    >
                      <input type="hidden" name="keyId" value={key.id} />
                      <button
                        className="p-1.5 border border-border rounded-md text-danger-strong"
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">
                  Chưa có key cá nhân nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {legacyHasCustomKey && keys.length === 0 && (
        <p className="text-xs text-warning-strong flex gap-2 m-0">
          <ShieldCheck size={14} /> Bạn vẫn có key cũ trong hệ thống legacy; app
          sẽ fallback để không gián đoạn. Hãy thêm lại key vào danh sách mới khi
          thuận tiện.
        </p>
      )}

      <form
        ref={formRef}
        action={(fd) =>
          submitAction(addUserApiKeyAction, fd, "Đã xác thực và thêm key.")
        }
        className="grid gap-4 border-t border-border pt-5"
      >
        <h2 className="text-lg font-bold m-0 text-text">Thêm Gemini API Key</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-3">
          <input
            name="name"
            placeholder="Tên gợi nhớ"
            required
            disabled={isPending}
            className="min-h-11 px-3 rounded-md border border-border bg-background text-sm"
          />
          <input
            name="apiKey"
            type="password"
            placeholder="AIzaSy..."
            required
            disabled={isPending}
            className="min-h-11 px-3 rounded-md border border-border bg-background text-sm"
          />
          <select
            name="provider"
            disabled={isPending}
            className="min-h-11 px-3 rounded-md border border-border bg-background text-sm"
          >
            <option value="gemini">Google Gemini</option>
          </select>
        </div>
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <p className="text-muted text-xs m-0">
            Không hiển thị lại raw key sau khi lưu. Tối đa 10 keys/user.
          </p>
          <button
            disabled={isPending}
            className="inline-flex items-center gap-2 min-h-11 rounded-md px-5 bg-accent text-white font-semibold text-sm disabled:opacity-60"
          >
            {isPending && <Loader2 size={16} className="animate-spin" />} Xác
            thực & thêm key
          </button>
        </div>
      </form>
    </section>
  );
}
