"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";

type AuthOverlayProps = {
  open: boolean;
  callbackUrl: string;
  onClose: () => void;
};

export function AuthOverlay({ open, callbackUrl, onClose }: AuthOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close authentication overlay"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/75 backdrop-blur-sm transition-opacity duration-300"
      />
      <div className="relative w-full max-w-[420px] rounded-2xl border border-cyan-400/25 bg-zinc-900/90 p-6 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_24px_60px_rgba(0,0,0,0.55)] transition duration-300 ease-out animate-[overlayIn_180ms_ease-out]">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.12),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(14,116,144,0.2),transparent_40%)]" />
        <div className="relative">
          <h2 className="text-xl font-semibold text-zinc-100">Access Control Room</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Sign in to activate your personal adaptive system.
          </p>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => void signIn("google", { callbackUrl })}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 transition hover:border-zinc-500"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-500 text-[10px]">
                G
              </span>
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => void signIn("github", { callbackUrl })}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 transition hover:border-zinc-500"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-500 text-[10px]">
                GH
              </span>
              Continue with GitHub
            </button>
          </div>

          <p className="mt-4 text-[11px] text-zinc-500">
            Your data stays private. No telemetry is shared.
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            By continuing, you agree to{" "}
            <Link href="/terms" className="underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-300">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-300">
              Privacy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
