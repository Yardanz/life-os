"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { generateErrorId, logSystemError } from "@/lib/obs";

type ErrorPageProps = {
  error: Error & { digest?: string };
};

export default function AppError({ error }: ErrorPageProps) {
  const errorId = useMemo(() => generateErrorId(), []);

  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }
  useEffect(() => {
    logSystemError({
      errorId,
      scope: "ui",
      name: "app.app.error-boundary",
      message: error?.message ?? "Unknown UI fault",
      path: "/app",
    });
  }, [error?.message, errorId]);

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-xl rounded-2xl border border-rose-500/35 bg-zinc-900/80 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">System Fault</p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-100">System Fault</h1>
        <p className="mt-3 text-sm text-zinc-300">A runtime error occurred in the operating interface.</p>
        <p className="mt-2 text-xs text-zinc-500">Error ID: {errorId}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            Reload
          </button>
          <Link
            href="/"
            className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-400"
          >
            Return to Landing
          </Link>
        </div>
      </div>
    </main>
  );
}
