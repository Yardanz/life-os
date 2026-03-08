"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, type AppTheme } from "@/lib/theme";

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors (private mode / blocked storage).
  }
}

export function GlobalThemeToggle() {
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const rootTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(rootTheme);
    setMounted(true);
  }, []);

  const nextTheme = useMemo<AppTheme>(() => (theme === "dark" ? "light" : "dark"), [theme]);

  if (!mounted) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className="fixed bottom-3 right-3 z-[90] inline-flex min-h-10 items-center gap-1.5 rounded-md border border-zinc-700/80 bg-zinc-900/85 px-2.5 py-2 text-xs text-zinc-200 shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-sm transition-colors duration-200 hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 sm:bottom-auto sm:right-3 sm:top-3 sm:gap-2 sm:px-3"
    >
      <span className="hidden uppercase tracking-[0.18em] text-zinc-500 sm:inline">Theme</span>
      <span className="font-medium text-zinc-100">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
