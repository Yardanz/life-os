import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PageHeader } from "@/components/public/PageHeader";

export default function TermsPage() {
  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10 text-zinc-100 sm:py-12">
        <PageHeader
          kicker="LEGAL"
          title="Terms"
          showBackToHome
        />

        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-300">
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
