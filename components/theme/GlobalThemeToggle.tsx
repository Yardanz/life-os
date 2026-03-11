"use client";

import { useMemo, useSyncExternalStore } from "react";
import { applyTheme, DEFAULT_THEME, readDocumentTheme, subscribeToThemeChanges, type AppTheme } from "@/lib/theme";

const subscribeHydration = () => () => {};

export function GlobalThemeToggle() {
  const mounted = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false
  );
  const theme = useSyncExternalStore(subscribeToThemeChanges, readDocumentTheme, () => DEFAULT_THEME);

  const nextTheme = useMemo<AppTheme>(() => (theme === "dark" ? "light" : "dark"), [theme]);

  if (!mounted) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
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
