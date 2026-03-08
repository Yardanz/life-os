import Link from "next/link";
import type { ReactNode } from "react";
import { PublicNavLinks } from "@/components/public/PublicNavLinks";

type PageHeaderProps = {
  kicker: string;
  title: string;
  subtitle?: string;
  navSlot?: ReactNode;
  showBackToHome?: boolean;
};

export function PageHeader({
  kicker,
  title,
  subtitle,
  navSlot,
  showBackToHome = false,
}: PageHeaderProps) {
  return (
    <header className="mb-8 sm:mb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-4">
          <Link
            href="/"
            aria-label="Go to home page"
            title="Home"
            className="group inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-xs uppercase tracking-[0.22em] text-zinc-400 transition-all duration-200 ease-out hover:text-cyan-200 hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          >
            <span
              aria-hidden="true"
              className="text-cyan-300/90 transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
            >
              &larr;
            </span>
            <span className="font-medium text-zinc-300 transition-colors duration-200 group-hover:text-cyan-100">LIFE OS</span>
            <span className="text-[10px] normal-case tracking-normal text-zinc-500 transition-colors duration-200 group-hover:text-cyan-200/90">
              Home
            </span>
          </Link>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{kicker}</p>
            <h1 className="text-2xl font-semibold text-zinc-100 sm:text-4xl">{title}</h1>
            {subtitle ? <p className="max-w-2xl text-sm text-zinc-400">{subtitle}</p> : null}
            {showBackToHome ? (
              <Link
                href="/"
                className="inline-flex text-xs text-zinc-400 underline underline-offset-2 transition hover:text-cyan-200"
              >
                Back to Home
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 text-sm sm:w-auto">
          {navSlot ?? <PublicNavLinks className="flex flex-wrap items-center gap-2 text-sm" />}
        </div>
      </div>
    </header>
  );
}
