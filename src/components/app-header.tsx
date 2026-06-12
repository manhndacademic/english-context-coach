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
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(stored);
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
    <header className="topbar">
      <Link className="brand" href="/dashboard">
        English Context Coach
      </Link>
      <nav className="nav" aria-label="Điều hướng chính">
        <Link href="/dashboard">Bảng điều khiển</Link>
        <Link href="/review">Ôn tập</Link>
        {email && <span className="muted" style={{ fontSize: "13px", margin: "0 4px" }}>{email}</span>}
        <form action={logoutAction}>
          <button className="link-button" type="submit">
            Đăng xuất
          </button>
        </form>

        <div className="theme-toggle" role="group" aria-label="Chọn giao diện">
          <button
            type="button"
            className={`theme-toggle-btn ${theme === "light" ? "active" : ""}`}
            onClick={() => changeTheme("light")}
            title="Giao diện sáng"
          >
            <Sun size={15} />
          </button>
          <button
            type="button"
            className={`theme-toggle-btn ${theme === "dark" ? "active" : ""}`}
            onClick={() => changeTheme("dark")}
            title="Giao diện tối"
          >
            <Moon size={15} />
          </button>
          <button
            type="button"
            className={`theme-toggle-btn ${theme === "system" ? "active" : ""}`}
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

