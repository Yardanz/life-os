import Link from "next/link";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNavLinks } from "@/components/public/PublicNavLinks";

export default function SecurityPage() {
  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-6xl overflow-x-hidden px-4 py-8 text-zinc-100 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">SECURITY</p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Security disclosure channel</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <PublicNavLinks className="flex flex-wrap items-center gap-2 text-sm" />
          </div>
        </header>

        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-sm text-zinc-300">
            Security contact and disclosure policy are published in `security.txt`.
          </p>
          <Link
            href="/.well-known/security.txt"
            className="mt-3 inline-flex rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            Open security.txt
          </Link>
        </section>

        <PublicFooter className="mt-8" />
      </main>
    </LifeOSBackground>
  );
}
