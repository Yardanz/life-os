"use client";

import { useEffect, useState } from "react";

const COMPACT_MEDIA_QUERY = "(max-width: 640px)";

export function useIsCompactViewport(): boolean {
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(COMPACT_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia(COMPACT_MEDIA_QUERY);
    const update = () => setIsCompact(media.matches);
    update();

    media.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  return isCompact;
}
