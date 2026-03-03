import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BillingPanel } from "@/app/app/settings/billing/BillingPanel";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { prisma } from "@/lib/prisma";

export default async function BillingSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/app/settings/billing");
  }

  const [entitlement, orders] = await Promise.all([
    prisma.entitlement.findUnique({
      where: { userId: session.user.id },
      select: {
        status: true,
        startsAt: true,
        expiresAt: true,
      },
    }),
    prisma.billingOrder.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        planCode: true,
        status: true,
        amount: true,
        currency: true,
        invoiceUrl: true,
        createdAt: true,
        paidAt: true,
      },
    }),
  ]);

  return (
    <LifeOSBackground>
      <BillingPanel
        entitlement={
          entitlement
            ? {
                status: entitlement.status,
                startsAt: entitlement.startsAt.toISOString(),
                expiresAt: entitlement.expiresAt.toISOString(),
              }
            : null
        }
        orders={orders.map((order) => ({
          ...order,
          amount: order.amount.toString(),
          createdAt: order.createdAt.toISOString(),
          paidAt: order.paidAt ? order.paidAt.toISOString() : null,
        }))}
      />
    </LifeOSBackground>
  );
}

