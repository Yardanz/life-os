import { isPublicAppAccessEnabled, isSoftLaunchModeEnabled } from "@/lib/env";

type SoftLaunchUser = {
  email?: string | null;
  role?: string | null;
};

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function getSoftLaunchWhitelist(): Set<string> {
  const raw = process.env.SOFT_LAUNCH_WHITELIST ?? "";
  const values = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  return new Set(values);
}

function isAdminByEmail(user: SoftLaunchUser): boolean {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  if (!adminEmail) return false;
  return normalizeEmail(user.email) === adminEmail;
}

export function hasSoftLaunchAccess(user: SoftLaunchUser | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role ?? "").trim().toUpperCase();
  if (role === "ADMIN") return true;
  if (isAdminByEmail(user)) return true;
  const email = normalizeEmail(user.email);
  if (!email) return false;
  return getSoftLaunchWhitelist().has(email);
}

type CanAccessAppInput = {
  user?: SoftLaunchUser | null;
};

export function canAccessApp({ user }: CanAccessAppInput): boolean {
  // UI/deployment access layer only. This does not alter engine math or auth providers.
  if (!user) return false;
  if ((user.role ?? "").trim().toUpperCase() === "ADMIN" || isAdminByEmail(user)) return true;
  if (isPublicAppAccessEnabled()) return true;
  if (isSoftLaunchModeEnabled()) return hasSoftLaunchAccess(user);
  return hasSoftLaunchAccess(user);
}
