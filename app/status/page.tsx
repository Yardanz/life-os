"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LandingAuthOverlayController } from "@/components/auth/LandingAuthOverlayController";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNavLinks } from "@/components/public/PublicNavLinks";
import { SYSTEM_VERSION } from "@/lib/version";

type HealthPayload = {
  ok: boolean;
  service?: string;
  version?: string;
  ts?: string;
};

function formatTimestamp(value?: string): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
}

export default function StatusPage() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        setLoading(true);
        setHealthError(null);
        const response = await fetch("/api/health", { cache: "no-store" });
        const payload = (await response.json()) as HealthPayload;
        if (!response.ok || !payload?.ok) {
          throw new Error("Health signal unavailable.");
        }
        if (!active) return;
        setHealth(payload);
      } catch {
        if (!active) return;
        setHealth(null);
        setHealthError("Health signal unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  const operational = useMemo(() => !loading && !healthError && health?.ok === true, [health, healthError, loading]);

  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-6xl overflow-x-hidden px-4 py-8 text-zinc-100 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">LIFE OS</p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-100">System Status</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <PublicNavLinks className="flex flex-wrap items-center gap-2 text-sm" />
            <Link
              href="/status?auth=1&callbackUrl=/status"
              className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200 transition hover:border-zinc-500"
            >
              Sign in
            </Link>
          </div>
        </header>

        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-300">Public service signal</p>
            <span
              className={`rounded-full border px-3 py-1 text-xs ${
                operational
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-200"
              }`}
            >
              {operational ? "Operational" : "Degraded"}
            </span>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
            <p>
              Service: <span className="text-zinc-100">{health?.service ?? "life-os"}</span>
            </p>
            <p>
              Version: <span className="text-zinc-100">{health?.version ?? SYSTEM_VERSION}</span>
            </p>
            <p>
              Timestamp: <span className="text-zinc-100">{formatTimestamp(health?.ts)}</span>
            </p>
          </div>

          {loading ? <p className="mt-3 text-xs text-zinc-500">Loading...</p> : null}
          {!loading && healthError ? <p className="mt-3 text-xs text-amber-200">{healthError}</p> : null}

          <p className="mt-4 text-xs text-zinc-500">Readiness checks are internal.</p>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Incidents</h2>
          <p className="mt-2 text-sm text-zinc-400">No incidents reported.</p>
        </section>

        <PublicFooter className="mt-8" />
      </main>
      <Suspense fallback={null}>
        <LandingAuthOverlayController />
      </Suspense>
    </LifeOSBackground>
  );
}
