"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sun, Moon, Monitor } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";

export function AppHeader({ email }: { email?: string | null }) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
      const activeTheme = stored || "system";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(activeTheme);
      if (activeTheme === "system") {
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
      } else {
        document.documentElement.setAttribute("data-theme", activeTheme);
      }
    } catch (e) {}
  }, []);

  const changeTheme = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    try {
      localStorage.setItem("theme", newTheme);
      if (newTheme === "system") {
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
      } else {
        document.documentElement.setAttribute("data-theme", newTheme);
      }
    } catch (e) {}
  };

  return (
    <header className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 border-b border-border pb-4 sm:pb-5 text-center sm:text-left">
      <Link 
        className="font-serif text-[22px] font-extrabold tracking-tight text-accent hover:text-accent-hover transition-colors m-0 w-full sm:w-auto" 
        href="/dashboard"
      >
        English Context Coach
      </Link>
      <nav className="flex flex-wrap items-center justify-center sm:justify-start w-full sm:w-auto gap-2 gap-y-2 gap-x-3" aria-label="Điều hướng chính">
        <Link 
          href="/dashboard" 
          className="border-0 bg-transparent text-muted text-sm font-semibold p-2 px-3 rounded-sm transition-all hover:text-text hover:bg-surface-strong cursor-pointer"
        >
          Bảng điều khiển
        </Link>
        <Link 
          href="/review" 
          className="border-0 bg-transparent text-muted text-sm font-semibold p-2 px-3 rounded-sm transition-all hover:text-text hover:bg-surface-strong cursor-pointer"
        >
          Ôn tập
        </Link>
        {email && (
          <span className="text-muted text-xs sm:text-sm m-0 sm:mx-1 self-center">
            {email}
          </span>
        )}
        <form action={logoutAction}>
          <button 
            className="border-0 bg-transparent text-muted text-sm font-semibold p-2 px-3 rounded-sm transition-all hover:text-text hover:bg-surface-strong cursor-pointer" 
            type="submit"
          >
            Đăng xuất
          </button>
        </form>

        <div className="flex items-center gap-0.5 bg-surface-strong border border-border p-[3px] rounded-full sm:ml-3" role="group" aria-label="Chọn giao diện">
          <button
            type="button"
            className={`flex items-center justify-center w-7 h-7 rounded-full text-muted transition-all border-none bg-transparent cursor-pointer hover:text-text hover:bg-border ${
              theme === "light" ? "text-accent bg-surface shadow-sm" : ""
            }`}
            onClick={() => changeTheme("light")}
            title="Giao diện sáng"
          >
            <Sun size={15} />
          </button>
          <button
            type="button"
            className={`flex items-center justify-center w-7 h-7 rounded-full text-muted transition-all border-none bg-transparent cursor-pointer hover:text-text hover:bg-border ${
              theme === "dark" ? "text-accent bg-surface shadow-sm" : ""
            }`}
            onClick={() => changeTheme("dark")}
            title="Giao diện tối"
          >
            <Moon size={15} />
          </button>
          <button
            type="button"
            className={`flex items-center justify-center w-7 h-7 rounded-full text-muted transition-all border-none bg-transparent cursor-pointer hover:text-text hover:bg-border ${
              theme === "system" ? "text-accent bg-surface shadow-sm" : ""
            }`}
            onClick={() => changeTheme("system")}
            title="Theo hệ thống"
          >
            <Monitor size={15} />
          </button>
        </div>
      </nav>
    </header>
  );
}
