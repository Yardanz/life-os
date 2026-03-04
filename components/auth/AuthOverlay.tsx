"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { ModalShell } from "@/components/ui/ModalShell";

type AuthOverlayProps = {
  open: boolean;
  callbackUrl: string;
  onClose: () => void;
};

export function AuthOverlay({ open, callbackUrl, onClose }: AuthOverlayProps) {
  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Authentication overlay" panelClassName="max-w-[420px] p-6">
      <div className="relative">
        <h2 className="text-xl font-semibold text-zinc-100">Sign in to Control Room</h2>
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
    </ModalShell>
  );
}
