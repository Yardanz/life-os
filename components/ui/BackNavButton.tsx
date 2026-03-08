"use client";

import { useRouter } from "next/navigation";

type BackNavButtonProps = {
  fallbackHref?: string;
  className?: string;
};

export function BackNavButton({ fallbackHref = "/", className }: BackNavButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window === "undefined") {
      router.push(fallbackHref);
      return;
    }

    if (window.history.length > 1) {
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
      className={`inline-flex min-h-10 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 ${
        className ?? ""
      }`}
    >
      Back
    </button>
  );
}
