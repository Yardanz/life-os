import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNavLinks } from "@/components/public/PublicNavLinks";
import { LanguageToggle } from "@/components/ui/LanguageToggle";

export default function TermsPage() {
  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10 text-zinc-100">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Legal</p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Terms</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <PublicNavLinks className="flex flex-wrap items-center gap-2 text-sm" />
            <LanguageToggle />
          </div>
        </header>

        <section className="mt-6 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-300">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">As-is software</h2>
            <p className="mt-1">
              LIFE OS is provided as-is as an operational software tool, without guarantees of uninterrupted service.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-zinc-100">No medical advice</h2>
            <p className="mt-1">
              LIFE OS is not a medical device and does not provide medical advice or diagnosis.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-zinc-100">Account responsibility</h2>
            <p className="mt-1">You are responsible for account credentials and all activity under your account.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-zinc-100">Acceptable use</h2>
            <p className="mt-1">
              Abuse, automated request flooding, and attempts to disrupt service availability are not permitted.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-zinc-100">Service changes</h2>
            <p className="mt-1">Features and limits may change as the system evolves for public reliability.</p>
          </div>
        </section>
        <PublicFooter className="mt-8" />
      </main>
    </LifeOSBackground>
  );
}
