import Link from "next/link";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { BackNavButton } from "@/components/ui/BackNavButton";

function resolveSupportEmail(): string {
  return process.env.SUPPORT_EMAIL ?? process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@lifeos.local";
}

export default function SupportPage() {
  const supportEmail = resolveSupportEmail();
  const mailtoHref = `mailto:${supportEmail}?subject=${encodeURIComponent("LIFE OS Support Request")}`;

  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <BackNavButton className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40" />
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">SUPPORT</p>
            <h1 className="text-3xl font-semibold text-zinc-100 sm:text-4xl">Operational support channel</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
              Contact point for platform operation issues, account access problems, and billing-related support.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Contact channel</p>
          <a
            href={mailtoHref}
            className="mt-3 inline-flex rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100 transition hover:border-cyan-300"
          >
            Email support
          </a>
          <p className="mt-2 text-sm text-zinc-300">{supportEmail}</p>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Response policy</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Scope: platform operation, account, access, and billing incidents.</li>
            <li>No coaching, clinical guidance, or personal behavior counseling.</li>
            <li>For security reports, use the dedicated security contact path.</li>
          </ul>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Related references</p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-300">
            <li>
              <Link href="/status" className="text-zinc-200 underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-100">
                System Status
              </Link>
            </li>
            <li>
              <Link href="/security" className="text-zinc-200 underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-100">
                Security
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-zinc-200 underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-100">
                Privacy
              </Link>
            </li>
          </ul>
        </section>

        <PublicFooter className="mt-10" />
      </main>
    </LifeOSBackground>
  );
}
