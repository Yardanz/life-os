import { auth } from "@/auth";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

type AdminCandidate = {
  role?: string | null;
  email?: string | null;
};

function normalizedAdminEmail(): string | null {
  const value = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return value && value.length > 0 ? value : null;
}

export function isAdmin(user: AdminCandidate | null | undefined): boolean {
  if (!user) return false;
  if ((user.role ?? "").toUpperCase() === "ADMIN") return true;
  // Admin bootstrap: set ADMIN_EMAIL to grant admin access without DB role edit.
  const adminEmail = normalizedAdminEmail();
  if (!adminEmail) return false;
  return (user.email ?? "").trim().toLowerCase() === adminEmail;
}

export async function requireAdmin() {
  const session = await auth();
  const sessionUserId = session?.user?.id;
  if (!sessionUserId) {
    throw new ApiError(404, "Not found");
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, email: true, role: true },
  });

  if (!user || !isAdmin(user)) {
    throw new ApiError(404, "Not found");
  }

  return user;
}
