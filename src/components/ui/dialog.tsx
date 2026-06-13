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
  // Listen for Escape key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop with backdrop-blur */}
      <div 
        className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Dialog card */}
      <div className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl p-6 overflow-hidden flex flex-col gap-4 z-10 transition-all duration-300 scale-100 animate-in zoom-in-95">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="absolute right-4 top-4 text-muted hover:text-text cursor-pointer rounded-full p-1.5 hover:bg-surface-strong transition-all focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label="Đóng"
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div className="flex gap-4 items-start pr-6 mt-1">
          {variant === "danger" && (
            <div className="bg-danger-light text-danger p-2.5 rounded-full border border-danger/10 shrink-0">
              <AlertTriangle size={20} />
            </div>
          )}
          <div className="grid gap-1.5">
            <h3 className="text-lg font-bold text-text m-0 leading-snug">
              {title}
            </h3>
            <p className="text-muted text-sm m-0 leading-relaxed">
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
    </div>
  );
}
