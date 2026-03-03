export default function HealthPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Health Check</h1>
        <p className="mt-3 text-zinc-700">
          Status: <span className="font-medium text-emerald-600">ok</span>
        </p>
      </section>
    </main>
  );
}
