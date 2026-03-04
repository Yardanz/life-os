import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set(["localhost:3000", "life-os-tau-five.vercel.app"]);

function resolveRequestHost(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) return forwardedHost.toLowerCase();
  const host = request.headers.get("host")?.trim();
  return (host ?? "").toLowerCase();
}

function validateHostOrReject(request: NextRequest): NextResponse | null {
  const host = resolveRequestHost(request);
  if (!ALLOWED_HOSTS.has(host)) {
    return NextResponse.json({ ok: false, error: "Untrusted host." }, { status: 400 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const rejection = validateHostOrReject(request);
  if (rejection) return rejection;
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const rejection = validateHostOrReject(request);
  if (rejection) return rejection;
  return handlers.POST(request);
}
