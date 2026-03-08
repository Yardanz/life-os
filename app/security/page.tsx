import Link from "next/link";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { BackNavButton } from "@/components/ui/BackNavButton";

export default function SecurityPage() {
  return (
    <LifeOSBackground>
      <main id="main-content" className="mx-auto min-h-screen w-full max-w-5xl overflow-x-hidden px-4 py-10 text-zinc-100 sm:px-6 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <BackNavButton className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40" />
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">SECURITY</p>
            <h1 className="text-3xl font-semibold text-zinc-100 sm:text-4xl">Security disclosure channel</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
              Official security contact and disclosure details are published through `security.txt`.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Disclosure policy</p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Use the published `security.txt` file for the current reporting contact and disclosure metadata.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Contact channel is defined by environment configuration.</li>
            <li>The `Expires` field is rotated automatically.</li>
          </ul>
          <Link
            href="/.well-known/security.txt"
            className="mt-4 inline-flex rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            Open security.txt
          </Link>
        </section>

        <PublicFooter className="mt-10" />
      </main>
    </LifeOSBackground>
  );
}
