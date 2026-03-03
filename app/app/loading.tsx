export default function AppControlRoomLoading() {
  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Control Room</p>
          <p className="mt-2 text-sm text-zinc-400">Loading…</p>
          <div className="mt-4 h-8 w-40 animate-pulse rounded bg-zinc-800/80" />
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/70" />
          ))}
        </section>
        <section className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/70" />
      </div>
    </main>
  );
}
