import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { BackNavButton } from "@/components/ui/BackNavButton";
import { PublicFooter } from "@/components/public/PublicFooter";
import Link from "next/link";
import { getSupportEmail } from "@/lib/supportContact";

export default function TermsPage() {
  const supportEmail = getSupportEmail();
  const supportHref = `mailto:${supportEmail}?subject=${encodeURIComponent("LIFE OS Billing Inquiry")}`;

  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <BackNavButton fallbackHref="/" label="← Back to Home" variant="text" navigation="href" />
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

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Billing and access</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Operator License access is activated only after confirmed payment status from the payment provider.</li>
              <li>Return page or browser redirect alone does not grant access.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Subscription term</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Operator License is available with monthly and yearly billing periods.</li>
              <li>Access remains active for the paid billing period.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Cancellation</h2>
            <p className="mt-3">
              Cancellation affects future renewals only. Current access remains active until the end of the paid term,
              except where otherwise required by law.
            </p>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Refunds</h2>
            <p className="mt-3">
              Refund handling is defined in the{" "}
              <Link href="/refund" className="text-zinc-200 underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-100">
                Refund Policy
              </Link>
              . Duplicate charges and verified technical payment failures may qualify for refunds. Active access already
              delivered is generally non-refundable, except where required by law.
            </p>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Payment provider</h2>
            <p className="mt-3">
              Payments are processed via hosted checkout. Final charged amount may vary based on selected payment
              method and applicable provider or network fees.
            </p>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Disputes and contact</h2>
            <p className="mt-3">
              For billing questions, payment disputes, or charge clarification, contact{" "}
              <a href={supportHref} className="text-zinc-200 underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-100">
                {supportEmail}
              </a>
              .
            </p>
          </div>
        </section>
        <PublicFooter className="mt-10" />
      </main>
    </LifeOSBackground>
  );
}
