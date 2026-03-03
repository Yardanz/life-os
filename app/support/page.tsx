import Link from "next/link";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNavLinks } from "@/components/public/PublicNavLinks";
import { LanguageToggle } from "@/components/ui/LanguageToggle";

function resolveSupportEmail(): string {
  return process.env.SUPPORT_EMAIL ?? process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@lifeos.local";
}

export default function SupportPage() {
  const supportEmail = resolveSupportEmail();
  const mailtoHref = `mailto:${supportEmail}?subject=${encodeURIComponent("LIFE OS Support Request")}`;

  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-6xl overflow-x-hidden px-4 py-8 text-zinc-100 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">SUPPORT</p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Operational support channel</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <PublicNavLinks className="flex flex-wrap items-center gap-2 text-sm" />
            <LanguageToggle />
          </div>
        </header>

        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-sm text-zinc-300">Contact channel:</p>
          <a
            href={mailtoHref}
            className="mt-2 inline-flex rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100 transition hover:border-cyan-300"
          >
            Email support
          </a>
          <p className="mt-2 text-sm text-zinc-400">{supportEmail}</p>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Response policy</h2>
          <p className="mt-2 text-sm text-zinc-300">Operational support only. No coaching or behavioral guidance.</p>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-medium text-zinc-100">Related references</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Link
              href="/status"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-500"
            >
              Status
            </Link>
            <Link
              href="/security"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-500"
            >
              Security
            </Link>
            <Link
              href="/privacy"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-500"
            >
              Privacy
            </Link>
          </div>
        </section>

        <PublicFooter className="mt-8" />
      </main>
    </LifeOSBackground>
  );
}
