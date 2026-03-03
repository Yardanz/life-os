import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "@/auth.config";
import { assertEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

assertEnv();

if (process.env.NODE_ENV !== "production") {
  const rawBaseUrl = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim() || "http://localhost:3000";
  try {
    const callbackUrl = new URL("/api/auth/callback/google", rawBaseUrl).toString();
    console.info(`[auth][dev] Google callback URL: ${callbackUrl}`);
  } catch {
    console.warn(`[auth][dev] Invalid NEXTAUTH_URL/AUTH_URL value: ${rawBaseUrl}`);
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
