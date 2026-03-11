"use client";

import { useMemo, useSyncExternalStore } from "react";
import { applyTheme, DEFAULT_THEME, readDocumentTheme, subscribeToThemeChanges, type AppTheme } from "@/lib/theme";

const subscribeHydration = () => () => {};

export function InlineThemeToggle() {
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
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1.5 text-xs text-zinc-200 shadow-[0_6px_16px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-colors duration-200 hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
    >
      <span className="uppercase tracking-[0.16em] text-zinc-500">Theme</span>
      <span className="font-medium text-zinc-100">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
