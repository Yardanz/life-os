import { NextResponse } from "next/server";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { DEMO_MODE_COOKIE, DEMO_MODE_COOKIE_VALUE, DEMO_MODE_MAX_AGE_SECONDS, isDemoModeEnabled } from "@/lib/demoMode";

export async function GET(request: Request) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  await ensureLiveDemoData();

  const redirectUrl = new URL("/app", request.url);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set({
    name: DEMO_MODE_COOKIE,
    value: DEMO_MODE_COOKIE_VALUE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_MODE_MAX_AGE_SECONDS,
  });
  return response;
}
