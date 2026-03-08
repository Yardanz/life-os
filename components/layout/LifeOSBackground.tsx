import type { ReactNode } from "react";

type LifeOSBackgroundProps = {
  children: ReactNode;
  className?: string;
};

export function LifeOSBackground({ children, className = "" }: LifeOSBackgroundProps) {
  return (
    <div className={`relative min-h-screen overflow-hidden text-zinc-100 ${className}`.trim()} style={{ backgroundColor: "var(--lifeos-bg)" }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 45% at 50% 0%, rgba(var(--lifeos-glow-rgb), var(--lifeos-glow-alpha)), transparent 62%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[size:36px_36px]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(var(--lifeos-grid-rgb), var(--lifeos-grid-alpha)) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--lifeos-grid-rgb), var(--lifeos-grid-alpha)) 1px, transparent 1px)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
