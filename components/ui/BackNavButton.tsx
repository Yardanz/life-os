"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { prepareBackNavigationScrollReset } from "@/lib/navigation/backScrollReset";

type BackNavButtonProps = {
  fallbackHref?: string;
  className?: string;
  label?: string;
  variant?: "button" | "text";
  navigation?: "history" | "href";
};

const BACK_BUTTON_CLASS =
  "inline-flex min-h-10 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40";

const BACK_TEXT_LINK_CLASS =
  "inline-flex min-h-10 items-center text-sm text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40";

export function BackNavButton({
  fallbackHref = "/",
  className,
  label = "Back",
  variant = "button",
  navigation = "history",
}: BackNavButtonProps) {
  const router = useRouter();
  const resolvedClassName = `${variant === "text" ? BACK_TEXT_LINK_CLASS : BACK_BUTTON_CLASS} ${className ?? ""}`.trim();

  if (navigation === "href") {
    return (
      <Link href={fallbackHref} className={resolvedClassName}>
        {label}
      </Link>
    );
  }

  const handleBack = () => {
    if (typeof window === "undefined") {
      router.push(fallbackHref);
      return;
    }

    if (window.history.length > 1) {
      prepareBackNavigationScrollReset();
      router.back();
      return;
    }

    const referrer = document.referrer;
    if (referrer) {
      try {
        const refUrl = new URL(referrer);
        const currentOrigin = window.location.origin;
        if (refUrl.origin === currentOrigin && refUrl.pathname !== window.location.pathname) {
          router.push(`${refUrl.pathname}${refUrl.search}${refUrl.hash}`);
          return;
        }
      } catch {
        // no-op
      }
    }

    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={resolvedClassName}
    >
      {label}
    </button>
  );
}
