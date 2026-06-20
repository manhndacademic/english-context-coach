"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useRef, useTransition } from "react";
import Link from "next/link";
import {
  Sun,
  Moon,
  Monitor,
  Settings,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { AppTheme } from "@/domain/types";

export function AppHeader({
  email,
  isAdmin,
  image,
  maxWidthClass = "max-w-[1200px]",
}: {
  email?: string | null;
  isAdmin?: boolean;
  image?: string | null;
  maxWidthClass?: string;
}) {
  const [theme, setTheme] = useState<AppTheme>("system");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme") as AppTheme | null;
      const activeTheme = stored || "system";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(activeTheme);
      if (activeTheme === "system") {
        const isDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        document.documentElement.setAttribute(
          "data-theme",
          isDark ? "dark" : "light"
        );
      } else {
        document.documentElement.setAttribute("data-theme", activeTheme);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const changeTheme = (newTheme: AppTheme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem("theme", newTheme);
      if (newTheme === "system") {
        const isDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        document.documentElement.setAttribute(
          "data-theme",
          isDark ? "dark" : "light"
        );
      } else {
        document.documentElement.setAttribute("data-theme", newTheme);
      }
    } catch (e) {}
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-surface/85 border-b border-border shadow-sm w-full transition-all duration-300">
      <div
        className={`mx-auto px-4 sm:px-6 py-3 flex items-center justify-between w-full ${maxWidthClass}`}
      >
        <Link
          className="font-serif text-base min-[385px]:text-lg sm:text-[22px] font-extrabold tracking-tight text-accent hover:text-accent-hover transition-colors m-0 shrink-0"
          href="/dashboard"
        >
          English Context Coach
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Main Navigation Links */}
          <nav
            className="flex items-center gap-0.5 sm:gap-1.5"
            aria-label="Điều hướng chính"
          >
            <Link
              href="/dashboard"
              className="border-0 bg-transparent text-muted text-xs sm:text-sm font-semibold p-1.5 px-2.5 sm:p-2 sm:px-3 rounded-md transition-all hover:text-text hover:bg-surface-strong cursor-pointer"
            >
              Bảng điều khiển
            </Link>
            <Link
              href="/review"
              className="border-0 bg-transparent text-muted text-xs sm:text-sm font-semibold p-1.5 px-2.5 sm:p-2 sm:px-3 rounded-md transition-all hover:text-text hover:bg-surface-strong cursor-pointer"
            >
              Ôn tập
            </Link>
            <Link
              href="/phrase-practice"
              className="border-0 bg-transparent text-muted text-xs sm:text-sm font-semibold p-1.5 px-2.5 sm:p-2 sm:px-3 rounded-md transition-all hover:text-text hover:bg-surface-strong cursor-pointer"
            >
              Luyện cụm từ
            </Link>
            <Link
              href="/history"
              className="border-0 bg-transparent text-muted text-xs sm:text-sm font-semibold p-1.5 px-2.5 sm:p-2 sm:px-3 rounded-md transition-all hover:text-text hover:bg-surface-strong cursor-pointer"
            >
              Lịch sử
            </Link>
          </nav>

          <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

          {/* Theme select controls */}
          <div
            className="hidden min-[480px]:flex items-center gap-0.5 bg-surface-strong border border-border p-[3px] rounded-full"
            role="group"
            aria-label="Chọn giao diện"
          >
            <button
              type="button"
              className={`flex items-center justify-center w-7 h-7 rounded-full text-muted transition-all border-none bg-transparent cursor-pointer hover:text-text hover:bg-border ${
                theme === "light" ? "text-accent bg-surface shadow-sm" : ""
              }`}
              onClick={() => changeTheme("light")}
              title="Giao diện sáng"
              aria-label="Giao diện sáng"
            >
              <Sun size={14} />
            </button>
            <button
              type="button"
              className={`flex items-center justify-center w-7 h-7 rounded-full text-muted transition-all border-none bg-transparent cursor-pointer hover:text-text hover:bg-border ${
                theme === "dark" ? "text-accent bg-surface shadow-sm" : ""
              }`}
              onClick={() => changeTheme("dark")}
              title="Giao diện tối"
              aria-label="Giao diện tối"
            >
              <Moon size={14} />
            </button>
            <button
              type="button"
              className={`flex items-center justify-center w-7 h-7 rounded-full text-muted transition-all border-none bg-transparent cursor-pointer hover:text-text hover:bg-border ${
                theme === "system" ? "text-accent bg-surface shadow-sm" : ""
              }`}
              onClick={() => changeTheme("system")}
              title="Theo hệ thống"
              aria-label="Theo hệ thống"
            >
              <Monitor size={14} />
            </button>
          </div>

          {/* User Account Dropdown */}
          {email && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-8 h-8 rounded-full overflow-hidden bg-accent-light text-accent flex items-center justify-center font-bold text-sm border border-accent/20 cursor-pointer shadow-sm hover:bg-accent/20 hover:scale-105 transition-all select-none focus:outline-none"
                aria-label="Menu người dùng"
              >
                {image ? (
                  <img
                    src={image}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  email[0].toUpperCase()
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-surface border border-border z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 bg-surface-strong/50 border-b border-border">
                    <span className="text-xs text-muted block leading-none">
                      Tài khoản
                    </span>
                    <span
                      className="text-xs font-semibold text-text block truncate mt-1.5 leading-none"
                      title={email}
                    >
                      {email}
                    </span>
                  </div>

                  <Link
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-text hover:bg-surface-strong transition-colors cursor-pointer"
                  >
                    <Settings size={14} className="text-muted" /> Cài đặt
                  </Link>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-accent font-bold hover:bg-surface-strong transition-colors cursor-pointer"
                    >
                      <ShieldAlert size={14} /> Trang quản trị
                    </Link>
                  )}

                  <div className="border-t border-border my-1" />

                  <button
                    type="button"
                    onClick={() => setShowLogoutDialog(true)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors border-0 bg-transparent text-left cursor-pointer font-semibold"
                  >
                    <LogOut size={14} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={() => {
          startTransition(async () => {
            await logoutAction();
          });
        }}
        isPending={isPending}
        title="Đăng xuất tài khoản"
        description="Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?"
        confirmText="Đăng xuất"
        variant="danger"
      />
    </header>
  );
}
