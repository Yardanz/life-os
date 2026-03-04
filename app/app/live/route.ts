import { NextResponse } from "next/server";
import { DEMO_MODE_COOKIE } from "@/lib/demoMode";

export async function GET(request: Request) {
  const redirectUrl = new URL("/app", request.url);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set({
    name: DEMO_MODE_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}
