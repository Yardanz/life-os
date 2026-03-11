import { UserPlan } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { getUserEntitlement, isOperatorActive } from "@/lib/billing/entitlement";
import { prisma } from "@/lib/prisma";

export type Plan = UserPlan;

type EnsureUserWithPlanOptions = {
  allowCreate?: boolean;
};

export function isPro(
  user: { operatorActive?: boolean; plan?: UserPlan | string } | null | undefined
): boolean {
  const normalized = typeof user?.plan === "string" ? user.plan.toUpperCase() : user?.plan;
  return normalized === UserPlan.PRO || Boolean(user?.operatorActive);
}

export async function ensureUserWithPlan(
  userId: string,
  _request?: Request,
  options?: EnsureUserWithPlanOptions
) {
  const allowCreate = options?.allowCreate ?? true;
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
    const resolvedPlan = existing.plan === UserPlan.PRO ? UserPlan.PRO : entitlementPlan;
    if (resolvedPlan !== existing.plan && resolvedPlan === UserPlan.PRO) {
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

  const operatorActive = false;
  return {
    ...created,
    plan: UserPlan.FREE,
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
