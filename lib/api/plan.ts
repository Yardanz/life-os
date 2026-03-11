import { UserPlan } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { getUserEntitlement, isOperatorActive } from "@/lib/billing/entitlement";
import { prisma } from "@/lib/prisma";

export type Plan = UserPlan;
export const PLAN_OVERRIDE_COOKIE = "lifeos_plan_override";

type EnsureUserWithPlanOptions = {
  allowCreate?: boolean;
};

export function isPro(
  user: { operatorActive?: boolean; plan?: UserPlan | string } | null | undefined
): boolean {
  const normalized = typeof user?.plan === "string" ? user.plan.toUpperCase() : user?.plan;
  return normalized === UserPlan.PRO || Boolean(user?.operatorActive);
}

function isDevPlanOverrideEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEV_TOOLS === "true";
}

function parseCookieValue(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const pair = parts.find((part) => part.startsWith(`${name}=`));
  if (!pair) return null;
  const raw = pair.slice(name.length + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function resolvePlanOverride(request?: Request): UserPlan | null {
  if (!request || !isDevPlanOverrideEnabled()) return null;
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const value = parseCookieValue(cookieHeader, PLAN_OVERRIDE_COOKIE);
  if (value === "pro") return UserPlan.PRO;
  if (value === "free") return UserPlan.FREE;
  return null;
}

export async function ensureUserWithPlan(
  userId: string,
  request?: Request,
  options?: EnsureUserWithPlanOptions
) {
  const allowCreate = options?.allowCreate ?? true;
  const overridePlan = resolvePlanOverride(request);
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      plan: true,
      adaptiveRiskOffset: true,
      adaptiveRecoveryOffset: true,
    },
  });

  if (existing) {
    const entitlement = await getUserEntitlement(existing.id);
    const entitlementPlan = isOperatorActive(entitlement) ? UserPlan.PRO : UserPlan.FREE;
    const resolvedPlan = overridePlan ?? (existing.plan === UserPlan.PRO ? UserPlan.PRO : entitlementPlan);
    if (!overridePlan && resolvedPlan !== existing.plan && resolvedPlan === UserPlan.PRO) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { plan: resolvedPlan },
      });
    }
    const operatorActive = resolvedPlan === UserPlan.PRO;
    return {
      ...existing,
      plan: resolvedPlan,
      operatorActive,
    };
  }

  if (!allowCreate) {
    throw new ApiError(404, "User not found.");
  }

  const fallbackEmail = `${userId.replace(/[^a-zA-Z0-9-_]/g, "_")}@local.lifeos`;
  const created = await prisma.user.create({
    data: {
      id: userId,
      email: fallbackEmail,
      plan: UserPlan.FREE,
    },
    select: {
      id: true,
      email: true,
      role: true,
      plan: true,
      adaptiveRiskOffset: true,
      adaptiveRecoveryOffset: true,
    },
  });

  const operatorActive = overridePlan === UserPlan.PRO;
  return {
    ...created,
    plan: operatorActive ? UserPlan.PRO : UserPlan.FREE,
    operatorActive,
  };
}

export async function requireProPlan(userId: string, request?: Request) {
  const user = await ensureUserWithPlan(userId, request);
  if (!isPro(user)) {
    throw new ApiError(403, "Operator capability required.", {
      code: "OPERATOR_REQUIRED",
      message: "Pay for Operator License to access this feature.",
    });
  }
  return user;
}
