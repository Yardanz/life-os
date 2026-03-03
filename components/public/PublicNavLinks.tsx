"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PUBLIC_NAV_LINKS } from "@/lib/publicLinks";
import { getInitialLang } from "@/lib/i18n";

type PublicNavLinksProps = {
  className?: string;
};

export function PublicNavLinks({ className = "" }: PublicNavLinksProps) {
  const pathname = usePathname();
  const currentLang =
    typeof window === "undefined" ? "en" : getInitialLang(new URLSearchParams(window.location.search).get("lang"));

  return (
    <div className={className}>
      {PUBLIC_NAV_LINKS.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}`));
        const params = new URLSearchParams();
        params.set("lang", currentLang);
        const query = params.toString();
        const href = query.length > 0 ? `${item.href}?${query}` : item.href;
        return (
          <Link
            key={item.href}
            href={href}
            className={`rounded-md border px-3 py-1.5 transition duration-200 ${
              active
                ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100"
                : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
