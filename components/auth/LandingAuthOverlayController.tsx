"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuthModal } from "@/components/auth/AuthModal";

export function LandingAuthOverlayController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const open = searchParams.get("auth") === "1" || Boolean(authError);
  const callbackUrl = useMemo(() => searchParams.get("callbackUrl") ?? pathname, [pathname, searchParams]);
  const mode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const closeOverlay = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("auth");
    next.delete("callbackUrl");
    next.delete("mode");
    next.delete("error");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return <AuthModal open={open} callbackUrl={callbackUrl} mode={mode} authError={authError} onClose={closeOverlay} />;
}
