import type { ProtocolRun } from "@prisma/client";

export function isProtocolActive(run: Pick<ProtocolRun, "appliedAt" | "horizonHours">, now: Date = new Date()): boolean {
  if (!run.appliedAt) return false;
  const expiresAt = run.appliedAt.getTime() + run.horizonHours * 60 * 60 * 1000;
  return now.getTime() < expiresAt;
}

export function getActiveProtocol<T extends Pick<ProtocolRun, "appliedAt" | "horizonHours">>(
  runs: T[],
  now: Date = new Date()
): T | null {
  return runs.find((run) => isProtocolActive(run, now)) ?? null;
}

