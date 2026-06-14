"use client";

import * as React from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "./button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isPending?: boolean;
  variant?: "default" | "danger";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  isPending = false,
  variant = "default",
}: ConfirmDialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  const supportsClosedBy = React.useMemo(() => {
    if (typeof window === "undefined") return true;
    return "closedBy" in HTMLDialogElement.prototype;
  }, []);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Handle backdrop click (light-dismiss fallback)
  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (event.target !== dialog) return;

    const rect = dialog.getBoundingClientRect();
    const isInside =
      rect.top <= event.clientY &&
      event.clientY <= rect.bottom &&
      rect.left <= event.clientX &&
      event.clientX <= rect.right;

    if (!isInside && !isPending) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={supportsClosedBy ? undefined : handleBackdropClick}
      {...({ closedby: "any" } as any)}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="z-50 m-auto bg-transparent border-none p-0 outline-none backdrop:bg-black/60 dark:backdrop:bg-black/80 backdrop:backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Dialog card */}
      <div className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl p-6 overflow-hidden flex flex-col gap-4 scale-100 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="absolute right-4 top-4 text-muted hover:text-text cursor-pointer rounded-full p-1.5 hover:bg-surface-strong transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Đóng"
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div className="flex gap-4 items-start pr-6 mt-1">
          {variant === "danger" ? (
            <div className="bg-danger-light text-danger p-2.5 rounded-full border border-danger/10 shrink-0">
              <AlertTriangle size={20} />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <h3
              id={titleId}
              className="text-lg font-bold text-text m-0 leading-snug"
            >
              {title}
            </h3>
            <p id={descId} className="text-muted text-sm m-0 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2.5 mt-3 pt-3 border-t border-border/60">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 cursor-pointer font-semibold"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "default"}
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 cursor-pointer font-semibold min-w-[100px]"
          >
            {isPending ? "Đang xử lý..." : confirmText}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
