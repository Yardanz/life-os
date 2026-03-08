"use client";

import Link from "next/link";
import { PUBLIC_FOOTER_LINKS } from "@/lib/publicLinks";
import { SYSTEM_VERSION } from "@/lib/version";

type PublicFooterProps = {
  className?: string;
};

function FooterGroup({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{title}</p>
      <div className="mt-2 space-y-1.5">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="block text-xs text-zinc-400 transition hover:text-zinc-200">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PublicFooter({ className = "" }: PublicFooterProps) {
  const productLinks = PUBLIC_FOOTER_LINKS.filter((item) => item.group === "product");
  const supportLinks = PUBLIC_FOOTER_LINKS.filter((item) => item.group === "support");
  const legalLinks = PUBLIC_FOOTER_LINKS.filter((item) => item.group === "legal");

  return (
    <footer className={`mt-auto border-t border-zinc-800 py-5 text-xs text-zinc-500 ${className}`}>
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">LIFE OS</p>
          <p className="text-xs text-zinc-500">System v{SYSTEM_VERSION}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3 sm:gap-10">
          <FooterGroup title="Product" links={productLinks} />
          <FooterGroup title="Support" links={supportLinks} />
          <FooterGroup title="Legal" links={legalLinks} />
        </div>
      </div>
    </footer>
  );
}
