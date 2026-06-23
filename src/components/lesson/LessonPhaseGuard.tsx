import * as React from "react";
import { Button } from "@/components/ui/button";

interface LessonPhaseGuardProps {
  exerciseStatus: string;
  currentPhase: "understand" | "practice";
  onUnlock: () => void;
  lockDescription?: string;
  children: React.ReactNode;
}

export function LessonPhaseGuard({
  exerciseStatus,
  currentPhase,
  onUnlock,
  lockDescription = "Xem chi tiết các điểm sửa lỗi ở bên trái. Khi sẵn sàng, hãy nhấn nút dưới đây để bắt đầu luyện tập.",
  children,
}: LessonPhaseGuardProps) {
  return (
    <div className="relative" id="exercise-panel-section">
      {children}

      {/* Overlay locks exercise panel when exercises completed but user is still in 'understand' phase */}
      {exerciseStatus === "succeeded" && currentPhase === "understand" && (
        <div className="absolute inset-0 bg-surface/85 backdrop-blur-[2px] rounded-lg flex flex-col items-center justify-center p-6 text-center select-none z-10 pointer-events-auto border border-dashed border-border/80">
          <div className="bg-accent-light p-3 rounded-full mb-3 text-accent border border-accent/15">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h3 className="text-base font-bold text-text mb-1">
            Bài tập thực hành đang khóa
          </h3>
          <p className="text-xs text-muted max-w-[240px] leading-relaxed mb-5">
            {lockDescription}
          </p>
          <Button
            type="button"
            onClick={onUnlock}
            className="animate-pulse-glow w-full font-bold"
          >
            Nhấn để bắt đầu luyện tập
          </Button>
        </div>
      )}
    </div>
  );
}
