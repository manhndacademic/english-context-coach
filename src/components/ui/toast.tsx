"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useEffect, useState } from "react";

export function Toaster() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const updateTheme = () => {
      const activeTheme = localStorage.getItem("theme") as
        | "light"
        | "dark"
        | "system"
        | null;
      setTheme(activeTheme || "system");
    };

    updateTheme();
    window.addEventListener("storage", updateTheme);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme") {
          const val = document.documentElement.getAttribute("data-theme");
          const stored = localStorage.getItem("theme");
          if (stored === "system" || !stored) {
            setTheme("system");
          } else {
            setTheme(val as "light" | "dark");
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      window.removeEventListener("storage", updateTheme);
      observer.disconnect();
    };
  }, []);

  return (
    <SonnerToaster
      position="bottom-right"
      theme={theme}
      richColors
      closeButton
      toastOptions={{
        className: "font-sans",
      }}
    />
  );
}
