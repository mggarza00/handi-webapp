"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark" | "system";

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  isDark: boolean;
  isMounted: boolean;
};

const ThemeCtx = createContext<Ctx | null>(null);

// Aplica clase "dark" en <html> segun preferencia guardada o sistema
function applyHtmlClass(next: Theme) {
  try {
    const root = document.documentElement;
    const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = next === "dark" || (next === "system" && preferDark);
    root.classList.toggle("dark", isDark);
  } catch (_e) {
    // ignore SSR or unavailable DOM
    void _e;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Carga preferencia
    try {
      const saved = (localStorage.getItem("theme") as Theme | null) ?? "system";
      setThemeState(saved);
      applyHtmlClass(saved);
    } catch {
      applyHtmlClass("system");
    }
    setMounted(true);

    // Reacciona a cambios del sistema cuando estamos en "system"
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const curr = (localStorage.getItem("theme") as Theme | null) ?? "system";
      if (curr === "system") applyHtmlClass("system");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const setTheme = (next: Theme) => {
    try {
      localStorage.setItem("theme", next);
    } catch (_e) {
      // ignore storage failures
      void _e;
    }
    setThemeState(next);
    applyHtmlClass(next);
  };

  const isDark = useMemo(() => {
    if (!mounted) return false;
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, [theme, mounted]);

  const value = useMemo<Ctx>(() => ({ theme, setTheme, isDark, isMounted: mounted }), [theme, isDark, mounted]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
