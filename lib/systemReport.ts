export type SystemReportContext = {
  ts: string;
  pathAndQuery: string;
  appVersion: string;
  mode: "Simulation" | "Live";
  guardrailState?: string | null;
  lifeScore?: number | null;
  load?: number | null;
  recovery?: number | null;
  risk?: number | null;
  confidencePct?: number | null;
  activeProtocol?: {
    state?: string | null;
    horizonHours?: number | null;
    mode?: string | null;
  } | null;
  integrity?: {
    score?: number | null;
    state?: string | null;
  } | null;
  lastErrorId?: string | null;
};

function f1(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : String(value);
}

export function buildSystemReport(context: SystemReportContext): string {
  const lines: string[] = [];
  lines.push("LIFE OS System Report");
  lines.push(`Timestamp: ${context.ts}`);
  lines.push(`URL: ${context.pathAndQuery}`);
  lines.push(`Version: ${context.appVersion || "dev"}`);
  lines.push(`Mode: ${context.mode}`);

  if (context.guardrailState) lines.push(`Guardrail: ${context.guardrailState}`);
  if (typeof context.lifeScore === "number") lines.push(`Life Score: ${f1(context.lifeScore)}`);

  const metrics: string[] = [];
  if (typeof context.load === "number") metrics.push(`Load ${f1(context.load)}`);
  if (typeof context.recovery === "number") metrics.push(`Recovery ${f1(context.recovery)}`);
  if (typeof context.risk === "number") metrics.push(`Risk ${f1(context.risk)}`);
  if (metrics.length > 0) lines.push(`Metrics: ${metrics.join(" | ")}`);

  if (typeof context.confidencePct === "number") lines.push(`Confidence: ${Math.round(context.confidencePct)}%`);

  if (context.activeProtocol) {
    const protocolBits: string[] = [];
    if (context.activeProtocol.state) protocolBits.push(context.activeProtocol.state);
    if (typeof context.activeProtocol.horizonHours === "number") {
      protocolBits.push(`${context.activeProtocol.horizonHours}h`);
    }
    if (context.activeProtocol.mode) protocolBits.push(context.activeProtocol.mode);
    if (protocolBits.length > 0) lines.push(`Active Protocol: ${protocolBits.join(" | ")}`);
  }

  if (context.integrity && (context.integrity.state || typeof context.integrity.score === "number")) {
    const integrityParts: string[] = [];
    if (typeof context.integrity.score === "number") integrityParts.push(`${Math.round(context.integrity.score)}%`);
    if (context.integrity.state) integrityParts.push(context.integrity.state);
    lines.push(`Integrity: ${integrityParts.join(" | ")}`);
  }

  if (context.lastErrorId) lines.push(`Error ID: ${context.lastErrorId}`);

  return lines.slice(0, 20).join("\n");
}
