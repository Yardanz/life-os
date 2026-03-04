"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { isPublicOAuthEnabledClient } from "@/lib/env";

type ProviderButton = {
  id: "google" | "github";
  label: string;
};

const providerButtons: ProviderButton[] = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
];

export function SignInButtons() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/app/live";
  const oauthEnabled = isPublicOAuthEnabledClient();

  return (
    <div className="mt-5 space-y-2">
      {!oauthEnabled ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Authentication disabled in this deployment.
        </p>
      ) : null}
      {providerButtons.map((provider) => (
        <button
          key={provider.id}
          type="button"
          disabled={!oauthEnabled}
          onClick={() => void signIn(provider.id, { callbackUrl })}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {provider.label}
        </button>
      ))}
    </div>
  );
}
