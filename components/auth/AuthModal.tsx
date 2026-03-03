"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { ModalShell } from "@/components/ui/ModalShell";
import { isPublicOAuthEnabledClient } from "@/lib/env";

type AuthModalProps = {
  open: boolean;
  callbackUrl: string;
  mode?: "signin" | "signup";
  authError?: string | null;
  onClose: () => void;
};

export function AuthModal({ open, callbackUrl, mode = "signin", authError = null, onClose }: AuthModalProps) {
  const oauthEnabled = isPublicOAuthEnabledClient();
  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Authentication modal" panelClassName="max-w-[460px] p-5 sm:p-6">
      {({ requestClose }) => (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Access</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-100">
                {mode === "signup" ? "Access Control" : "Access Control"}
              </h2>
              <p className="mt-2 text-sm text-zinc-300">Authentication is required to operate the system.</p>
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              Close
            </button>
          </div>

          {authError ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Authentication failed. Retry or close.
            </p>
          ) : null}

          {!oauthEnabled ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Authentication disabled in this deployment.
            </p>
          ) : null}

          <div className="space-y-2">
            <button
              type="button"
              data-autofocus
              disabled={!oauthEnabled}
              onClick={() => void signIn("google", { callbackUrl })}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-500 text-[10px]">
                G
              </span>
              Continue with Google
            </button>
            <button
              type="button"
              disabled={!oauthEnabled}
              onClick={() => void signIn("github", { callbackUrl })}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-500 text-[10px]">
                GH
              </span>
              Continue with GitHub
            </button>
          </div>

          <p className="text-[11px] text-zinc-500">
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
      )}
    </ModalShell>
  );
}
