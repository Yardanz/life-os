import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { BackNavButton } from "@/components/ui/BackNavButton";
import { PublicFooter } from "@/components/public/PublicFooter";
import { getSupportEmail } from "@/lib/supportContact";

export default function RefundPage() {
  const supportEmail = getSupportEmail();
  const mailtoHref = `mailto:${supportEmail}?subject=${encodeURIComponent("LIFE OS Refund Request")}`;

  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <BackNavButton fallbackHref="/" label={"\u2190 Back to Home"} variant="text" navigation="href" />
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">LEGAL</p>
            <h1 className="text-3xl font-semibold text-zinc-100 sm:text-4xl">Refund Policy</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
              Refund terms for purchases processed through LIFE OS hosted checkout.
            </p>
          </div>
        </header>

        <section className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm leading-relaxed text-zinc-300">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Scope</h2>
            <p className="mt-3">This policy applies to purchases made through LIFE OS hosted checkout.</p>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Access activation</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Operator License access is activated only after confirmed payment status from the payment provider.</li>
              <li>Return URL or browser redirect alone is not treated as payment confirmation.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Refund eligibility</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Duplicate charge for the same order: eligible for full refund.</li>
              <li>Technical payment error resulting in charge without access activation: eligible for full refund after verification.</li>
              <li>Fraud or unauthorized transaction claims are reviewed case-by-case with supporting evidence.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Non-refundable cases</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Active subscription periods already delivered are non-refundable, except where required by law.</li>
              <li>User cancellation after activation applies to future renewal only.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Cancellation</h2>
            <p className="mt-3">
              Cancellation stops future renewals; current paid access remains active until period end.
            </p>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Processing time</h2>
            <p className="mt-3">
              Approved refunds are processed within a reasonable business timeframe. Provider and network processing
              times may add delays outside our direct control.
            </p>
          </div>

          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact</h2>
            <p className="mt-3">
              Refund requests should be sent to <span className="text-zinc-100">{supportEmail}</span>. Include Order
              ID, payment timestamp, and transaction reference.
            </p>
            <a
              href={mailtoHref}
              className="mt-3 inline-flex min-h-10 break-all rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500"
            >
              {supportEmail}
            </a>
          </div>
        </section>

        <PublicFooter className="mt-10" />
      </main>
    </LifeOSBackground>
  );
}


