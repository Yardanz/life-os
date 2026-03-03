import Link from "next/link";
import { notFound } from "next/navigation";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { requireAdmin } from "@/lib/authz";
import { getHealthMetrics, parseHealthWindow, type HealthWindow } from "@/lib/admin/healthConsole";
import { HealthConsoleControls } from "@/app/app/admin/health/HealthConsoleControls";

type HealthPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function metricCard(label: string, value: string, hint?: string) {
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-2xl text-zinc-100">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-zinc-500">{hint}</p> : null}
    </article>
  );
}

export default async function AdminHealthPage({ searchParams }: HealthPageProps) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const params = (await searchParams) ?? {};
  const rawWindow = Array.isArray(params.window) ? params.window[0] : params.window;
  const selectedWindow: HealthWindow = parseHealthWindow(rawWindow);

  const metrics = await getHealthMetrics(selectedWindow);

  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 text-zinc-100 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Internal Health Console</h1>
            <p className="mt-1 text-xs text-zinc-500">Operational metrics for the selected data window.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app"
              className="min-h-9 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 transition hover:border-zinc-500"
            >
              Back to Control Room
            </Link>
          </div>
        </header>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-400">Snapshot timestamp: {new Date(metrics.nowISO).toLocaleString()}</p>
            <HealthConsoleControls initialWindow={selectedWindow} />
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Operators</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricCard("Total users", formatNumber(metrics.operators.totalUsers))}
            {metricCard("New users (7d)", formatNumber(metrics.operators.newUsers7d))}
            {metricCard("Active users (24h)", formatNumber(metrics.operators.activeUsers24h))}
            {metricCard(`Active users (${selectedWindow})`, formatNumber(metrics.operators.activeUsersSelectedWindow))}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Check-ins</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metricCard("Check-ins (24h)", formatNumber(metrics.checkins.checkins24h))}
            {metricCard("Check-ins (7d)", formatNumber(metrics.checkins.checkins7d))}
            {metricCard(
              "Avg check-ins / active user (24h)",
              formatNumber(metrics.checkins.avgPerActiveUser24h, 2),
              metrics.checkins.avgPerActiveUser24h == null ? "Not available from current storage" : undefined
            )}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Guardrails (last known per active user)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricCard("OPEN", formatNumber(metrics.guardrails.open))}
            {metricCard("CAUTION", formatNumber(metrics.guardrails.caution))}
            {metricCard("LOCKDOWN", formatNumber(metrics.guardrails.lockdown))}
            {metricCard("Unavailable", formatNumber(metrics.guardrails.unavailable), "Not available from current storage")}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Protocol enforcement</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metricCard("Active protocol users", formatNumber(metrics.protocol.activeProtocolUsers))}
            {metricCard(
              `Active protocol ratio (${selectedWindow})`,
              metrics.protocol.activeProtocolRatio == null ? "—" : `${formatNumber(metrics.protocol.activeProtocolRatio, 1)}%`
            )}
            {metricCard(`Protocol applies (${selectedWindow})`, formatNumber(metrics.protocol.protocolAppliesSelectedWindow))}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Billing</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricCard(`Paid orders (${selectedWindow})`, formatNumber(metrics.billing.paidOrdersSelectedWindow))}
            {metricCard(`Pending orders (${selectedWindow})`, formatNumber(metrics.billing.pendingOrdersSelectedWindow))}
            {metricCard("Entitlements active", formatNumber(metrics.billing.activeEntitlements))}
            {metricCard(
              "IPN invalid signature",
              metrics.billing.invalidSignatureCount === null ? "—" : formatNumber(metrics.billing.invalidSignatureCount),
              metrics.billing.invalidSignatureCount === null ? "Not available from current storage" : undefined
            )}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">Errors (Observability-lite)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {metricCard(`Error events (${selectedWindow})`, formatNumber(metrics.errors.countSelectedWindow))}
            {metricCard("Storage", metrics.errors.available ? "Available" : "—", metrics.errors.storageNote)}
          </div>
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Recent Error IDs</p>
            {metrics.errors.recent.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">Not available from current storage</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {metrics.errors.recent.map((item) => (
                  <li key={`${item.errorId}:${item.ts}`} className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-2">
                    <p className="font-mono text-xs text-zinc-100">{item.errorId}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {new Date(item.ts).toLocaleString()} • {item.path ?? item.name}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </LifeOSBackground>
  );
}
