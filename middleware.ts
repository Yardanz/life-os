import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import authConfig from "@/auth.config";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { canAccessApp } from "@/lib/softLaunch";

const { auth } = NextAuth(authConfig);

type MiddlewareAuthUser = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

type AuthenticatedRequest = NextRequest & {
  auth?: {
    user?: MiddlewareAuthUser;
  } | null;
};

export default auth((request: AuthenticatedRequest) => {
  if (request.auth?.user) {
    if (!canAccessApp({ user: request.auth.user })) {
      const errorId = generateErrorId();
      logSystemError({
        errorId,
        scope: "ui",
        name: "app_access_restricted",
        message: "App access restricted by deployment flags.",
        userId: request.auth.user.id ?? null,
        path: request.nextUrl.pathname,
        meta: { reason: "deployment_gate" },
      });
      return NextResponse.redirect(new URL("/restricted", request.nextUrl.origin));
    }
    return NextResponse.next();
  }

  const signInUrl = new URL("/", request.nextUrl.origin);
  signInUrl.searchParams.set("auth", "1");
  const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  signInUrl.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: ["/app/:path*"],
};
