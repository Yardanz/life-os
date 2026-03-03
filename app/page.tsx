import Link from "next/link";
import { auth, signOut } from "@/auth";
import { LandingAuthOverlayController } from "@/components/auth/LandingAuthOverlayController";
import { LandingBottomCtas } from "@/components/landing/LandingBottomCtas";
import { SmoothScrollButton } from "@/components/landing/SmoothScrollButton";
import { SystemPreviewCard } from "@/components/landing/SystemPreviewCard";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNavLinks } from "@/components/public/PublicNavLinks";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { normalizeLang, t, type Lang } from "@/lib/i18n";

type LandingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const session = await auth();
  const params = (await searchParams) ?? {};
  const rawLang = Array.isArray(params.lang) ? params.lang[0] : params.lang;
  const lang: Lang = normalizeLang(rawLang) ?? "en";
  const withLang = (href: string) => {
    const url = new URL(href, "http://localhost");
    url.searchParams.set("lang", lang);
    return `${url.pathname}${url.search}`;
  };
  const buildAuthOverlayHref = (callbackUrl: string) => {
    const url = new URL("/", "http://localhost");
    url.searchParams.set("auth", "1");
    url.searchParams.set("callbackUrl", callbackUrl);
    url.searchParams.set("lang", lang);
    return `${url.pathname}${url.search}`;
  };
  const controlRoomAuthHref = buildAuthOverlayHref("/app");
  const stayOnPageAuthHref = buildAuthOverlayHref(withLang("/"));
  const primaryHref = session ? "/app" : controlRoomAuthHref;

  return (
    <LifeOSBackground>
      <main id="main-content" className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col overflow-x-hidden px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">LIFE OS</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <PublicNavLinks className="flex flex-wrap items-center gap-2" />
            <LanguageToggle />
            {session ? (
              <>
                <Link
                  href={withLang("/app")}
                  className="min-h-10 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-cyan-100"
                >
                  Open /app
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button
                    type="submit"
                    className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                href={stayOnPageAuthHref}
                className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
              >
                Access Control
              </Link>
            )}
          </div>
        </header>

        <section className="mt-16 grid gap-8 lg:mt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Operational Interface</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
              {t("landingHeroTitle", lang)}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-zinc-300 sm:text-lg">{t("landingHeroSubtitle", lang)}</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">
              Not motivation.
              <br />
              Not streaks.
              <br />
              Not AI advice.
              <br />A deterministic stability model.
            </p>
            <p className="mt-2 text-xs text-zinc-500">Built on deterministic state modeling. No black-box inference.</p>
            <p className="mt-4 text-xs text-zinc-500">
              Most tools help you do more.
              <br />
              LIFE OS prevents system collapse.
            </p>
            <ul className="mt-4 grid gap-1 text-xs text-zinc-400 sm:grid-cols-3">
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-400/80" />
                It detects instability before burnout happens
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-400/80" />
                and shifts you into stable operating capacity.
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-400/80" />
                Constraints are deterministic.
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={withLang(primaryHref)}
                className="min-h-10 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition duration-200 hover:border-cyan-300"
              >
                {t("ctaEnterControlRoom", lang)}
              </Link>
              <Link
                href={withLang("/demo")}
                className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition duration-200 hover:border-zinc-500"
              >
                {t("ctaViewGuidedDemo", lang)}
              </Link>
              <Link
                href={withLang("/demo/live")}
                className="min-h-10 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 transition duration-200 hover:border-cyan-300"
              >
                Open simulation view
              </Link>
              <SmoothScrollButton
                targetId="how-it-works"
                headingId="how-it-works-heading"
                className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition duration-200 hover:border-zinc-500"
              >
                How the system works &darr;
              </SmoothScrollButton>
            </div>
          </div>
          <SystemPreviewCard />
        </section>

        <div aria-hidden="true" className="mt-12 h-px w-full bg-zinc-800/50" />

        <section id="how-it-works" className="mt-20">
          <h2 id="how-it-works-heading" tabIndex={-1} className="text-xl font-semibold text-zinc-100 focus:outline-none">
            How it works
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 transition duration-200 hover:border-zinc-700">
              <h3 className="text-sm font-semibold text-zinc-100">Daily check-in (60 seconds)</h3>
              <p className="mt-2 text-sm text-zinc-400">
                You input measurable signals: sleep, strain, workload, recovery.
              </p>
            </article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 transition duration-200 hover:border-zinc-700">
              <h3 className="text-sm font-semibold text-zinc-100">State detection</h3>
              <p className="mt-2 text-sm text-zinc-400">
                The system calculates load, recovery capacity, and overload probability.
              </p>
            </article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 transition duration-200 hover:border-zinc-700">
              <h3 className="text-sm font-semibold text-zinc-100">Guardrail control</h3>
              <p className="mt-2 text-sm text-zinc-400">
                When instability rises, constraints tighten. When stability returns, bandwidth expands.
              </p>
            </article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 transition duration-200 hover:border-zinc-700">
              <h3 className="text-sm font-semibold text-zinc-100">Deterministic model</h3>
              <p className="mt-2 text-sm text-zinc-400">
                No sentiment scoring
                <br />No AI suggestions
                <br />No stochastic drift
                <br />State evolves only from measurable inputs
                <br />
                <br />
                Forward projections reflect structural load dynamics, not motivational assumptions.
                <br />
                <br />
                You operate within operating capacity - not willpower.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-xl font-semibold text-zinc-100">
            This is not a productivity app.
            <br />
            Most apps help you do more.
            <br />
            LIFE OS prevents system collapse.
          </h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/70">
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Habit Apps</th>
                  <th className="px-4 py-3 font-medium">LIFE OS</th>
                </tr>
              </thead>
              <tbody className="text-zinc-400">
                <tr className="border-b border-zinc-800/80 transition-colors duration-200 hover:bg-zinc-800/20">
                  <td className="px-4 py-3">Track behavior</td>
                  <td className="px-4 py-3">Model load dynamics</td>
                </tr>
                <tr className="border-b border-zinc-800/80 transition-colors duration-200 hover:bg-zinc-800/20">
                  <td className="px-4 py-3">Reward streaks</td>
                  <td className="px-4 py-3">Enforce capacity limits</td>
                </tr>
                <tr className="border-b border-zinc-800/80 transition-colors duration-200 hover:bg-zinc-800/20">
                  <td className="px-4 py-3">Motivation loops</td>
                  <td className="px-4 py-3">Risk-based state control</td>
                </tr>
                <tr className="border-b border-zinc-800/80 transition-colors duration-200 hover:bg-zinc-800/20">
                  <td className="px-4 py-3">Subjective reflection</td>
                  <td className="px-4 py-3">Measurable system signals</td>
                </tr>
                <tr className="transition-colors duration-200 hover:bg-zinc-800/20">
                  <td className="px-4 py-3">Goal chasing</td>
                  <td className="px-4 py-3">Stability preservation</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            Guardrail system
            <br />
            OPEN &rarr; CAUTION &rarr; LOCKDOWN
            <br />
            State transitions occur when overload probability exceeds thresholds.
            <br />
            Constraints override intention.
            <br />
            <br />
            Example scenario
            <br />
            Example: Founder working 11-12h/day for 3 weeks
            <br />
            &rarr; Recovery capacity declines
            <br />
            &rarr; Overload probability increases
            <br />
            &rarr; Guardrail shifts to CAUTION
            <br />
            &rarr; Stabilization protocol activates
            <br />
            &rarr; Load is reduced
            <br />
            &rarr; System returns to baseline
            <br />
            <br />
            LIFE OS forecasts system stability - not productivity.
            <br />
            <br />
            This is not about doing more.
            <br />
            It is about preventing systemic failure.
            <br />
            <br />
            This is about preserving operational integrity.
          </p>
        </section>

        <section className="mt-20">
          <h2 className="text-xl font-semibold text-zinc-100">Designed for high-load environments</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <h3 className="text-sm font-semibold text-zinc-100">Knowledge Workers</h3>
              <p className="mt-1 text-sm text-zinc-400">Protect deep work under cognitive strain.</p>
            </article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <h3 className="text-sm font-semibold text-zinc-100">Athletes & Lifters</h3>
              <p className="mt-1 text-sm text-zinc-400">Balance training stress against recovery reserve.</p>
            </article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <h3 className="text-sm font-semibold text-zinc-100">Founders & Operators</h3>
              <p className="mt-1 text-sm text-zinc-400">Scale effort without crossing overload thresholds.</p>
            </article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <h3 className="text-sm font-semibold text-zinc-100">Neurodivergent Users</h3>
              <p className="mt-1 text-sm text-zinc-400">Externalize regulation signals into visible system states.</p>
            </article>
          </div>
        </section>

        <section className="mt-20 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300/80">Extension Layer</p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-100">Forward Simulation Engine (Operator License)</h2>
          <p className="mt-3 text-sm text-zinc-300">The base system operates in real-time.</p>
          <p className="mt-2 text-sm text-zinc-300">The Operator License adds forward modeling:</p>
          <p className="mt-2 text-sm text-zinc-300">
            - 30-day projection curves
            <br />- Burnout probability modeling
            <br />- Scenario comparison (A/B)
            <br />- Anti-chaos stabilization tightening
          </p>
          <p className="mt-3 text-sm text-amber-100">This extends the system with forward stability modeling.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/pricing#pro"
              className="rounded-md border border-amber-400/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 shadow-[0_0_0_1px_rgba(251,191,36,0.15)] transition duration-200 hover:border-amber-300/70 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            >
              Pay for Operator License
            </Link>
            <p className="text-xs text-zinc-400">Unlock 30-day projections &amp; Anti-Chaos</p>
          </div>
        </section>

        <section className="mt-20 rounded-2xl border border-zinc-800 bg-zinc-950/85 p-6">
          <h2 className="text-2xl font-semibold text-zinc-100">Operate within your system&apos;s limits - intentionally.</h2>
          <LandingBottomCtas primaryHref={withLang(primaryHref)} lang={lang} />
        </section>

        <PublicFooter />
      </main>
      {!session ? <LandingAuthOverlayController /> : null}
    </LifeOSBackground>
  );
}



