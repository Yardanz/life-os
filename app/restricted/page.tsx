import Link from "next/link";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNavLinks } from "@/components/public/PublicNavLinks";

export default function RestrictedPage() {
  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10 text-zinc-100">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Sign in</p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Access Restricted</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <PublicNavLinks className="flex flex-wrap items-center gap-2 text-sm" />
          </div>
        </header>

        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-300">
          <p>This deployment is operating in controlled mode.</p>
          <p className="mt-2">Contact operator for access.</p>
          <div className="mt-4">
            <Link
              href="/support"
              className="inline-flex min-h-9 items-center rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 text-xs font-medium text-cyan-100 transition hover:border-cyan-300/60"
            >
              Contact Support
            </Link>
          </div>
        </section>

        <PublicFooter className="mt-8" />
      </main>
    </LifeOSBackground>
  );
}
