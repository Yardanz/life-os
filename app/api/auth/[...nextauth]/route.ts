import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { startTiming } from "@/lib/observability/timing";

export const runtime = "nodejs";

function normalizeHost(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function hostFromUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    return normalizeHost(new URL(rawUrl.trim()).host);
  } catch {
    return null;
  }
}

function parseHostsList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => normalizeHost(item))
    .filter((item): item is string => Boolean(item));
}

function buildAllowedHosts(): Set<string> {
  const hosts = new Set<string>(parseHostsList(process.env.AUTH_ALLOWED_HOSTS));

  const authUrlHost = hostFromUrl(process.env.AUTH_URL);
  if (authUrlHost) {
    hosts.add(authUrlHost);
  }

  const nextAuthUrlHost = hostFromUrl(process.env.NEXTAUTH_URL);
  if (nextAuthUrlHost) {
    hosts.add(nextAuthUrlHost);
  }

  if (process.env.NODE_ENV !== "production") {
    hosts.add("localhost:3000");
  }

  return hosts;
}

const ALLOWED_HOSTS = buildAllowedHosts();

function resolveRequestHost(request: NextRequest): string {
  const forwardedHost = normalizeHost(request.headers.get("x-forwarded-host")?.split(",")[0]);
  if (forwardedHost) return forwardedHost;
  return normalizeHost(request.headers.get("host")) ?? "";
}

function validateHostOrReject(request: NextRequest): NextResponse | null {
  if (ALLOWED_HOSTS.size === 0) {
    return NextResponse.json({ ok: false, error: "Host validation misconfigured." }, { status: 500 });
  }
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
