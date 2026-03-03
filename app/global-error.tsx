"use client";

import Link from "next/link";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#070b10] px-4 py-10 text-zinc-100">
        <div className="mx-auto max-w-xl rounded-2xl border border-rose-500/35 bg-zinc-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">System Fault</p>
          <h1 className="mt-2 text-xl font-semibold text-zinc-100">System Fault</h1>
          <p className="mt-3 text-sm text-zinc-300">A runtime error occurred. Reload or return to Control Room.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reset}
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
      </body>
    </html>
  );
}
