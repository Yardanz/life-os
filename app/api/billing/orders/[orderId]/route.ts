import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserEntitlement, isOperatorActive } from "@/lib/billing/entitlement";
import { getBillingOrderForUser } from "@/lib/billing/service";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const [order, entitlement] = await Promise.all([
    getBillingOrderForUser(userId, orderId),
    getUserEntitlement(userId),
  ]);
  if (!order) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        order: {
          id: order.id,
          planCode: order.planCode,
          status: order.status,
          amount: order.amount.toString(),
          currency: order.currency,
          provider: order.provider,
          providerInvoiceId: order.providerInvoiceId,
          invoiceUrl: order.invoiceUrl,
          payCurrency: order.payCurrency,
          paidAt: order.paidAt ? order.paidAt.toISOString() : null,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
          payment: order.payment
            ? {
                providerPaymentId: order.payment.providerPaymentId,
                providerInvoiceId: order.payment.providerInvoiceId,
                status: order.payment.status,
                actuallyPaid: order.payment.actuallyPaid
                  ? order.payment.actuallyPaid.toString()
                  : null,
                confirmedAt: order.payment.confirmedAt
                  ? order.payment.confirmedAt.toISOString()
                  : null,
                updatedAt: order.payment.updatedAt.toISOString(),
              }
            : null,
        },
        license: {
          active: isOperatorActive(entitlement),
          status: entitlement?.status ?? null,
          expiresAt: entitlement?.expiresAt ? entitlement.expiresAt.toISOString() : null,
        },
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
