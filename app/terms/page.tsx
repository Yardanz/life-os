import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { BackNavButton } from "@/components/ui/BackNavButton";
import { PublicFooter } from "@/components/public/PublicFooter";

export default function TermsPage() {
  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <BackNavButton className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40" />
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">LEGAL</p>
            <h1 className="text-3xl font-semibold text-zinc-100 sm:text-4xl">Terms</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
              Concise operating terms for using LIFE OS.
            </p>
          </div>
        </header>

        <section className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm leading-relaxed text-zinc-300">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">As-is software</h2>
            <p className="mt-3">
              LIFE OS is provided as-is as an operational software tool, without guarantees of uninterrupted service.
            </p>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">No medical advice</h2>
            <p className="mt-3">
              LIFE OS is not a medical device and does not provide medical advice or diagnosis.
            </p>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Account responsibility</h2>
            <p className="mt-3">You are responsible for account credentials and activity under your account.</p>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Acceptable use</h2>
            <p className="mt-3">
              Abuse, automated request flooding, and attempts to disrupt service availability are not permitted.
            </p>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Service changes</h2>
            <p className="mt-3">
              Features, limits, and capability access (including entitlement-gated depth) may change as the service evolves.
            </p>
          </div>
        </section>
        <PublicFooter className="mt-10" />
      </main>
    </LifeOSBackground>
  );
}
