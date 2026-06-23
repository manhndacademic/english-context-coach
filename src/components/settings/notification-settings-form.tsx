"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff, Clock } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";

const HOURS = [6, 7, 8, 9] as const;

interface NotificationSettingsFormProps {
  initialEnabled: boolean;
  initialHour: number;
}

export function NotificationSettingsForm({
  initialEnabled,
  initialHour,
}: NotificationSettingsFormProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [hour, setHour] = useState(initialHour);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = async (nextEnabled: boolean, nextHour: number) => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailDigestEnabled: nextEnabled,
            emailDigestHour: nextHour,
          }),
        });
        if (!res.ok) throw new Error("Lưu thất bại");
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch {
        setError("Không thể lưu cài đặt. Vui lòng thử lại.");
      }
    });
  };

  const toggleEnabled = (next: boolean) => {
    setEnabled(next);
    save(next, hour);
  };

  const changeHour = (next: number) => {
    setHour(next);
    save(enabled, next);
  };

  return (
    <SectionCard className="p-5 sm:p-8 gap-4">
      <SectionCard.Header
        title="Nhắc nhở ôn tập hàng ngày"
        icon={<Bell size={18} className="text-accent" />}
      />
      <SectionCard.Body className="gap-4">
        <p className="text-sm text-muted leading-relaxed m-0">
          Mỗi ngày, hệ thống sẽ gửi email tóm tắt các từ/cụm từ cần ôn tập hôm
          nay đến địa chỉ email của bạn.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-between gap-4 py-3 border-b border-border">
          <div className="grid gap-1">
            <span className="text-sm font-semibold text-text">
              Nhận email nhắc nhở
            </span>
            <span className="text-xs text-muted">
              {enabled
                ? "Đang bật — bạn sẽ nhận email khi có từ cần ôn"
                : "Đang tắt — không có email nào được gửi"}
            </span>
          </div>
          <button
            type="button"
            id="notification-toggle"
            role="switch"
            aria-checked={enabled}
            aria-label="Nhận email nhắc nhở"
            onClick={() => toggleEnabled(!enabled)}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 ${
              enabled ? "bg-accent" : "bg-surface-strong"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Hour picker — only visible when enabled */}
        {enabled && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-muted text-sm">
              <Clock size={14} />
              <span>Gửi lúc:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {HOURS.map((h) => (
                <button
                  type="button"
                  key={h}
                  id={`digest-hour-${h}`}
                  onClick={() => changeHour(h)}
                  disabled={isPending}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 disabled:opacity-50 ${
                    hour === h
                      ? "bg-accent text-white border-accent shadow-sm"
                      : "bg-surface border-border text-text hover:border-accent hover:text-accent"
                  }`}
                >
                  {h}:00
                </button>
              ))}
            </div>
            <span className="text-xs text-muted">sáng (giờ Việt Nam)</span>
          </div>
        )}

        {/* Feedback */}
        {saved && (
          <div className="text-sm text-success font-medium">
            ✓ Đã lưu cài đặt
          </div>
        )}
        {error && (
          <div className="text-sm text-danger font-medium">{error}</div>
        )}

        {/* Info note when disabled */}
        {!enabled && (
          <div className="flex items-start gap-2 text-xs text-muted bg-surface-strong rounded-md p-3">
            <BellOff size={14} className="mt-0.5 shrink-0" />
            <span>
              Bật tính năng này để nhận email nhắc nhở mỗi ngày khi có từ/cụm từ
              cần ôn tập trong hàng đợi.
            </span>
          </div>
        )}
      </SectionCard.Body>
    </SectionCard>
  );
}
