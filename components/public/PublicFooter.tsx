"use client";

import Link from "next/link";
import { PUBLIC_FOOTER_LINKS } from "@/lib/publicLinks";
import { getInitialLang } from "@/lib/i18n";
import { SYSTEM_VERSION } from "@/lib/version";

type PublicFooterProps = {
  className?: string;
};

export function PublicFooter({ className = "" }: PublicFooterProps) {
  const currentLang =
    typeof window === "undefined" ? "en" : getInitialLang(new URLSearchParams(window.location.search).get("lang"));

  return (
    <footer className={`mt-auto flex items-center justify-between border-t border-zinc-800 py-4 text-xs text-zinc-500 ${className}`}>
      <span>LIFE OS • System v{SYSTEM_VERSION}</span>
      <div className="flex flex-wrap items-center gap-3">
        {PUBLIC_FOOTER_LINKS.map((item) => {
          const href = item.href.startsWith("/")
            ? `${item.href}?lang=${currentLang}`
            : item.href;
          return (
            <Link key={item.href} href={href} className="transition hover:text-zinc-300">
              {item.label}
            </Link>
          );
        })}
      </div>
    </footer>
  );
}
