"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthModal } from "@/components/auth/AuthModal";

export function LandingAuthOverlayController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const open = searchParams.get("auth") === "1";
  const callbackUrl = useMemo(() => {
    const raw = searchParams.get("callbackUrl");
    if (!raw) return "/app/live";
    return raw.startsWith("/") ? raw : "/app/live";
  }, [searchParams]);
  const mode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const closeOverlay = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("auth");
    next.delete("callbackUrl");
    next.delete("mode");
    next.delete("error");
    const query = next.toString();
    router.replace(query ? `/?${query}` : "/");
  };

  return <AuthModal open={open} callbackUrl={callbackUrl} mode={mode} authError={authError} onClose={closeOverlay} />;
}
