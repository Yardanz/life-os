"use client";

import { useEffect, useState } from "react";

export type ViewMode = "simplified" | "full";

const VIEW_MODE_KEY = "lifeos_view_mode";

export function useViewMode() {
  const [mode, setModeState] = useState<ViewMode>("simplified");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_MODE_KEY);
      if (stored === "full" || stored === "simplified") {
        setModeState(stored);
      }
    } catch {
      // ignore storage access errors
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const setMode = (nextMode: ViewMode) => {
    setModeState(nextMode);
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, nextMode);
    } catch {
      // ignore storage access errors
    }
  };

  return { mode, setMode, isHydrated };
}
