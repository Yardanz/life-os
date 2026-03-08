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

export function InlineThemeToggle() {
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
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1.5 text-xs text-zinc-200 shadow-[0_6px_16px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-colors duration-200 hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
    >
      <span className="uppercase tracking-[0.16em] text-zinc-500">Theme</span>
      <span className="font-medium text-zinc-100">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
