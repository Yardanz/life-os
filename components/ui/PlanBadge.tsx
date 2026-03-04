"use client";

type PlanBadgeProps = {
  plan: "FREE" | "PRO" | string | null | undefined;
  className?: string;
};

export function PlanBadge({ plan, className = "" }: PlanBadgeProps) {
  const normalized = typeof plan === "string" ? plan.toUpperCase() : "FREE";
  const isOperator = normalized === "PRO";
  const label = isOperator ? "Plan: Operator" : "Plan: Observer";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
        isOperator
          ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-100"
          : "border-zinc-600 bg-zinc-800 text-zinc-100",
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
