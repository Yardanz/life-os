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

    const referrer = document.referrer;
    let internalReferrerTarget: string | null = null;
    if (referrer) {
      try {
        const refUrl = new URL(referrer);
        const current = window.location;
        const sameOrigin = refUrl.origin === current.origin;
        const samePathAndQuery = refUrl.pathname === current.pathname && refUrl.search === current.search && refUrl.hash === current.hash;
        if (sameOrigin && !samePathAndQuery) {
          internalReferrerTarget = `${refUrl.pathname}${refUrl.search}${refUrl.hash}`;
        }
      } catch {
        internalReferrerTarget = null;
      }
    }

    if (window.history.length > 1 && internalReferrerTarget) {
      prepareBackNavigationScrollReset();
      router.back();
      return;
    }

    if (internalReferrerTarget) {
      router.push(internalReferrerTarget);
      return;
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
