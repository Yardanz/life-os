import { ApiError } from "@/lib/api/errors";
import {
  DEMO_MODE_COOKIE,
  DEMO_MODE_COOKIE_VALUE,
  DEMO_MODE_MAX_AGE_SECONDS,
  LIVE_DEMO_USER_ID,
} from "@/lib/demo/constants";

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const pairs = cookieHeader.split(";").map((part) => part.trim()).filter(Boolean);
  const result: Record<string, string> = {};
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
}

export function isDemoModeRequest(request: Request): boolean {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  return cookies[DEMO_MODE_COOKIE] === DEMO_MODE_COOKIE_VALUE;
}

export function requireWritableMode(request: Request): void {
  if (isDemoModeRequest(request)) {
    throw new ApiError(403, "DEMO_READ_ONLY");
  }
}

export { DEMO_MODE_COOKIE, DEMO_MODE_COOKIE_VALUE, DEMO_MODE_MAX_AGE_SECONDS, LIVE_DEMO_USER_ID };
