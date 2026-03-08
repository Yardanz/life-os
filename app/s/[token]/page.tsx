import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import type { SanitizedSnapshotPayload } from "@/lib/snapshotPolicy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "LIFE OS - System Snapshot",
  description: "Read-only deterministic system state snapshot. No personal data.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "LIFE OS - System Snapshot",
    description: "Read-only deterministic system state snapshot. No personal data.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "LIFE OS - System Snapshot",
    description: "Read-only deterministic system state snapshot. No personal data.",
  },
};

type SnapshotPageProps = {
  params: Promise<{ token: string }>;
};

function asPayload(value: unknown): SanitizedSnapshotPayload {
  if (!value || typeof value !== "object") {
    return {
      capturedAt: new Date().toISOString(),
      lifeScore: null,
      guardrailState: null,
      load: null,
      recovery: null,
      risk: null,
      confidence: null,
      integrity: null,
      protocolSummary: null,
    };
  }
  return value as SanitizedSnapshotPayload;
}

function renderUnavailable(message: string) {
  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10 text-zinc-100 sm:px-6">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h1 className="text-xl font-semibold text-zinc-100">{message}</h1>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            Return to Landing
          </Link>
        </section>
      </main>
    </LifeOSBackground>
  );
}

function formatMetric(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

export default async function SnapshotPage({ params }: SnapshotPageProps) {
  const { token } = await params;
  const now = new Date();

  const snapshot = await prisma.systemSnapshot.findUnique({
    where: { token },
    select: {
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
      payload: true,
    },
  });

  if (!snapshot || snapshot.revokedAt) {
    return renderUnavailable("Snapshot unavailable.");
  }

  if (snapshot.expiresAt.getTime() <= now.getTime()) {
    return renderUnavailable("Snapshot unavailable.");
  }

  const payload = asPayload(snapshot.payload);

  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 text-zinc-100 sm:px-6">
        <header className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">System Snapshot</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Read-only system state</h1>
          <p className="mt-2 text-xs text-zinc-500">
            Read-only snapshot. No personal data. Deterministic system state at time of capture.
          </p>
          <p className="mt-1 text-xs text-zinc-500">Public snapshot link. No personal data. Expires automatically.</p>
          <p className="mt-2 text-xs text-zinc-400">
            Captured at: {new Date(payload.capturedAt ?? snapshot.createdAt.toISOString()).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Expires at: {snapshot.expiresAt.toLocaleString()}</p>
        </header>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Life Score</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">
              {formatMetric(payload.lifeScore)}
            </p>
          </article>
          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Guardrail</p>
            <p className="mt-1 text-lg font-medium text-zinc-100">{payload.guardrailState ?? "—"}</p>
          </article>
          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Confidence</p>
            <p className="mt-1 text-lg font-medium text-zinc-100">
              {payload.confidence !== null ? `${Math.round(Math.max(0, Math.min(1, payload.confidence)) * 100)}%` : "-"}
            </p>
          </article>
          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Integrity</p>
            <p className="mt-1 text-lg font-medium text-zinc-100">
              {payload.integrity && payload.integrity.score !== null
                ? `${formatMetric(payload.integrity.score)} (${payload.integrity.state ?? "—"})`
                : "—"}
            </p>
          </article>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-3">
          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Load</p>
            <p className="mt-1 text-lg font-medium text-zinc-100">{formatMetric(payload.load)}</p>
          </article>
          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Recovery</p>
            <p className="mt-1 text-lg font-medium text-zinc-100">{formatMetric(payload.recovery)}</p>
          </article>
          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Risk</p>
            <p className="mt-1 text-lg font-medium text-zinc-100">{formatMetric(payload.risk)}</p>
          </article>
        </section>

        <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Active Protocol Summary</p>
          {payload.protocolSummary ? (
            <p className="mt-2 text-sm text-zinc-200">
              {payload.protocolSummary.state ?? "—"} • {payload.protocolSummary.horizonHours ?? "—"}h • {payload.protocolSummary.mode ?? "—"} • constraints: {payload.protocolSummary.constraintsCount ?? 0}
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">No active protocol at capture time.</p>
          )}
        </section>
      </main>
    </LifeOSBackground>
  );
}
