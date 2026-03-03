type OperatorStatusInput = {
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  expiresAt: Date;
};

export function getOperatorStatusLabel(
  entitlement: OperatorStatusInput | null | undefined,
  now: Date = new Date()
): string {
  if (!entitlement) return "Not active";
  if (entitlement.status === "REVOKED") return "Revoked";
  if (entitlement.status === "EXPIRED" || now >= entitlement.expiresAt) return "Expired";
  return `Active until ${entitlement.expiresAt.toLocaleString()}`;
}
