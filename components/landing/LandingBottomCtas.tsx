"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";

type LandingBottomCtasProps = {
  primaryHref: string;
};

export function LandingBottomCtas({ primaryHref }: LandingBottomCtasProps) {
  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={primaryHref}
          className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition duration-200 hover:border-cyan-300"
        >
          {t("ctaEnterControlRoom")}
        </Link>

        <Link
          href="/pricing#pro"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition duration-200 hover:border-amber-300/60"
        >
          Pay for Operator License
        </Link>
      </div>
    </>
  );
}
