"use client";

import { useEffect, useMemo, useState } from "react";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { BackNavButton } from "@/components/ui/BackNavButton";
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
  const statusChip = useMemo(() => {
    if (loading) {
      return {
        label: "Checking",
        className: "border-zinc-600/60 bg-zinc-800/40 text-zinc-200",
      };
    }
    if (!operational) {
      return {
        label: "Degraded",
        className: "border-amber-500/40 bg-amber-500/10 text-amber-200",
      };
    }
    return {
      label: "Operational",
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    };
  }, [loading, operational]);

  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <BackNavButton className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40" />
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">LIFE OS STATUS</p>
            <h1 className="text-3xl font-semibold text-zinc-100 sm:text-4xl">System Status</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
              Public operational status note for the current LIFE OS service release.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Operational status</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">Current public service signal for LIFE OS.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs ${statusChip.className}`}>{statusChip.label}</span>
          </div>

          <div className="mt-4 grid gap-2.5 text-sm sm:grid-cols-3">
            <article className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Service</p>
              <p className="mt-1 text-zinc-100">{health?.service ?? "life-os"}</p>
            </article>
            <article className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Version</p>
              <p className="mt-1 text-zinc-100">{health?.version ?? SYSTEM_VERSION}</p>
            </article>
            <article className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Timestamp</p>
              <p className="mt-1 break-words text-zinc-100">{formatTimestamp(health?.ts)}</p>
            </article>
          </div>

          {loading ? <p className="mt-3 text-xs text-zinc-500">Refreshing health signal...</p> : null}
          {!loading && healthError ? <p className="mt-3 text-xs text-amber-200">{healthError}</p> : null}
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Incidents</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{operational ? "No active incidents reported." : "Status is degraded. Incident details are not published on this page."}</p>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Notes</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Status is based on the public `/api/health` signal.</li>
            <li>Readiness checks and low-level diagnostics remain internal.</li>
            <li>Displayed time uses your local timezone.</li>
          </ul>
        </section>

        <PublicFooter className="mt-10" />
      </main>
    </LifeOSBackground>
  );
}
