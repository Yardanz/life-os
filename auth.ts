import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "@/auth.config";
import { assertEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

function normalizeAuthUrl(rawValue: string): string {
  const trimmed = rawValue.trim().replace(/\/+$/, "");
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("AUTH_URL must start with http:// or https://");
  }
  return parsed.toString().replace(/\/+$/, "");
}

const rawAuthUrl = process.env.AUTH_URL?.trim() ?? "";
if (rawAuthUrl.length > 0) {
  const normalizedAuthUrl = normalizeAuthUrl(rawAuthUrl);
  process.env.AUTH_URL = normalizedAuthUrl;
  // Keep NextAuth alias in sync for provider internals that still read NEXTAUTH_URL.
  process.env.NEXTAUTH_URL = normalizedAuthUrl;
} else if (process.env.NODE_ENV === "production") {
  throw new Error("AUTH_URL is required in production and must include protocol.");
} else {
  const fallbackAuthUrl = "http://localhost:3000";
  process.env.AUTH_URL = fallbackAuthUrl;
  process.env.NEXTAUTH_URL = fallbackAuthUrl;
}

assertEnv();

if (process.env.NODE_ENV !== "production") {
  const rawBaseUrl = process.env.AUTH_URL?.trim() || "http://localhost:3000";
  try {
    const callbackUrl = new URL("/api/auth/callback/google", normalizeAuthUrl(rawBaseUrl)).toString();
    console.info(`[auth][dev] Google callback URL: ${callbackUrl}`);
  } catch {
    console.warn(`[auth][dev] Invalid AUTH_URL value: ${rawBaseUrl}`);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  ...authConfig,
});
