import type { ReactNode } from "react";

type LifeOSBackgroundProps = {
  children: ReactNode;
  className?: string;
};

export function LifeOSBackground({ children, className = "" }: LifeOSBackgroundProps) {
  return (
    <div className={`relative min-h-screen overflow-hidden bg-[#070b10] text-zinc-100 ${className}`.trim()}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_0%,rgba(34,211,238,0.18),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:36px_36px]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
