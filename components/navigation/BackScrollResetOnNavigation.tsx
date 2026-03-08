"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import {
  consumeBackNavigationScrollReset,
  restoreBackNavigationScrollBehavior,
} from "@/lib/navigation/backScrollReset";

export function BackScrollResetOnNavigation() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (!consumeBackNavigationScrollReset()) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      restoreBackNavigationScrollBehavior();
    }, 120);
  }, [pathname]);

  return null;
}
