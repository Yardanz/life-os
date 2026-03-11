"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { ModalShell } from "@/components/ui/ModalShell";
import { isPublicOAuthEnabledClient } from "@/lib/env.public";

type AuthModalProps = {
  open: boolean;
  callbackUrl: string;
  mode?: "signin" | "signup";
  authError?: string | null;
  onClose: () => void;
};

const providerButtonClass =
  "flex min-h-11 w-full items-center justify-center gap-2.5 rounded-md border border-zinc-700/90 bg-zinc-900/95 px-4 py-2 text-[13px] font-medium tracking-[0.01em] text-zinc-100 transition-colors duration-150 hover:border-zinc-500 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-50";

function GoogleProviderIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 text-zinc-300" focusable="false">
      <path
        fill="currentColor"
        d="M8.159 6.855v2.744h3.958c-.171 1.102-1.283 3.235-3.958 3.235-2.313 0-4.199-1.914-4.199-4.272S5.846 4.29 8.159 4.29c1.316 0 2.198.563 2.704 1.05l1.836-1.769C11.52 2.474 10 1.758 8.159 1.758 4.342 1.758 1.24 4.909 1.24 8.562s3.102 6.804 6.919 6.804c3.992 0 6.633-2.683 6.633-6.531 0-.454-.053-.801-.12-1.213z"
      />
    </svg>
  );
}

function GitHubProviderIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 text-zinc-300" focusable="false">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8a8.01 8.01 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 4.7c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

export function AuthModal({ open, callbackUrl, mode = "signin", authError = null, onClose }: AuthModalProps) {
  const oauthEnabled = isPublicOAuthEnabledClient();
  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Authentication modal" panelClassName="max-w-[460px] p-5 sm:p-6">
      {(
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">ACCESS</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">
              {mode === "signup" ? "Access LIFE OS" : "Access LIFE OS"}
            </h2>
            <p className="mt-2 text-sm text-zinc-300">Authentication required to access the operational interface.</p>
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

          <div className="space-y-2.5">
            <button
              type="button"
              data-autofocus
              disabled={!oauthEnabled}
              onClick={() => void signIn("google", { callbackUrl })}
              className={providerButtonClass}
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <GoogleProviderIcon />
              </span>
              <span className="leading-none">Continue with Google</span>
            </button>
            <button
              type="button"
              disabled={!oauthEnabled}
              onClick={() => void signIn("github", { callbackUrl })}
              className={providerButtonClass}
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <GitHubProviderIcon />
              </span>
              <span className="leading-none">Continue with GitHub</span>
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
