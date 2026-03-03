"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckInModal } from "@/components/checkin/CheckInModal";
import { getLocalISODate } from "@/lib/date/localDate";
import { t, type Lang } from "@/lib/i18n";

type LandingBottomCtasProps = {
  primaryHref: string;
  lang: Lang;
};

export function LandingBottomCtas({ primaryHref, lang }: LandingBottomCtasProps) {
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInDate] = useState<string>(() => getLocalISODate());
  const withLang = (href: string) => {
    const url = new URL(href, "http://localhost");
    url.searchParams.set("lang", lang);
    return `${url.pathname}${url.search}`;
  };

  return (
    <>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={primaryHref}
          className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition duration-200 hover:border-cyan-300"
        >
          {t("ctaEnterControlRoom", lang)}
        </Link>

        <button
          type="button"
          onClick={() => setCheckInOpen(true)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition duration-200 hover:border-zinc-500"
        >
          Start check-in
        </button>

        <Link
          href={withLang("/pricing#pro")}
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition duration-200 hover:border-amber-300/60"
        >
          Pay for Operator License
        </Link>
      </div>

      <CheckInModal
        open={checkInOpen}
        dateISO={checkInDate}
        onClose={() => setCheckInOpen(false)}
        onSaved={() => setCheckInOpen(false)}
      />
    </>
  );
}
