import { EntitlementKey, EntitlementStatus } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

export async function getUserEntitlement(userId: string) {
  return prisma.entitlement.findUnique({
    where: { userId },
    select: {
      id: true,
      key: true,
      status: true,
      startsAt: true,
      expiresAt: true,
      sourceOrderId: true,
      updatedAt: true,
    },
  });
}

export function isOperatorActive(
  entitlement:
    | {
        key: EntitlementKey;
        status: EntitlementStatus;
        expiresAt: Date;
      }
    | null
    | undefined,
  now: Date = new Date()
): boolean {
  if (!entitlement) return false;
  return (
    entitlement.key === EntitlementKey.OPERATOR_LICENSE &&
    entitlement.status === EntitlementStatus.ACTIVE &&
    now < entitlement.expiresAt
  );
}

export async function requireOperator(userId: string) {
  const entitlement = await getUserEntitlement(userId);
  if (!isOperatorActive(entitlement)) {
    throw new ApiError(403, "Operator capability required.", {
      code: "OPERATOR_REQUIRED",
      message: "Pay for Operator License to access this capability.",
    });
  }
  return entitlement;
}

export async function hasActiveOperatorLicense(
  userId: string,
  now: Date = new Date()
): Promise<boolean> {
  const entitlement = await getUserEntitlement(userId);
  return isOperatorActive(entitlement, now);
}

export function computeExpiresAt(now: Date, periodDays: number): Date {
  const safeDays = Math.max(1, Math.floor(periodDays));
  return new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000);
}
