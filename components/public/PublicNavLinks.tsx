"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PUBLIC_NAV_LINKS } from "@/lib/publicLinks";

type PublicNavLinksProps = {
  className?: string;
};

export function PublicNavLinks({ className = "" }: PublicNavLinksProps) {
  const pathname = usePathname();

  return (
    <div className={className}>
      {PUBLIC_NAV_LINKS.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}`));
        return (
          <Link
            key={item.href}
            href={item.href}
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
