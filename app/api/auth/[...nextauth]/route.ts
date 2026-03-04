import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { startTiming } from "@/lib/observability/timing";

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
  const timer = startTiming("api.auth.GET", { path: request.nextUrl.pathname });
  const rejection = validateHostOrReject(request);
  if (rejection) {
    timer.end({ status: rejection.status });
    return rejection;
  }
  const response = await handlers.GET(request);
  timer.end({ status: response.status });
  return response;
}

export async function POST(request: NextRequest) {
  const timer = startTiming("api.auth.POST", { path: request.nextUrl.pathname });
  const rejection = validateHostOrReject(request);
  if (rejection) {
    timer.end({ status: rejection.status });
    return rejection;
  }
  const response = await handlers.POST(request);
  timer.end({ status: response.status });
  return response;
}
