"use client";

import { t, type Locale } from "@/lib/i18n";

type StatusBadgeProps = {
  status: "Stable" | "Overloaded" | "Declining" | "Growth";
  locale?: Locale;
};

const STATUS_STYLES: Record<StatusBadgeProps["status"], string> = {
  Stable: "border-zinc-600 bg-zinc-800 text-zinc-100",
  Overloaded: "border-rose-500/60 bg-rose-500/15 text-rose-200",
  Declining: "border-amber-500/60 bg-amber-500/15 text-amber-200",
  Growth: "border-emerald-500/60 bg-emerald-500/15 text-emerald-200",
};

export function StatusBadge({ status, locale = "en" }: StatusBadgeProps) {
  const label =
    status === "Stable"
      ? t("modeStableWord", locale)
      : status === "Overloaded"
        ? t("modeOverload", locale)
        : status === "Declining"
          ? t("modeDrift", locale)
          : "Growth";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
        STATUS_STYLES[status],
      ].join(" ")}
    >
      {label}
    </span>
  );
}
