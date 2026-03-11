import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import BillingStatusClient from "@/app/billing/status/BillingStatusClient";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { getUserEntitlement, isOperatorActive } from "@/lib/billing/entitlement";
import { getBillingOrderForUser } from "@/lib/billing/service";

type BillingStatusPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function BillingStatusPage({ searchParams }: BillingStatusPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/billing/status");
  }
  const userId = session.user.id;
  const params = (await searchParams) ?? {};
  const orderId = getSingleParam(params.order);

  if (!orderId) {
    return (
      <LifeOSBackground>
        <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 text-zinc-100 sm:px-6">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Billing</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Order reference missing</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Open billing settings to inspect recent orders and payment status.
            </p>
            <Link
              href="/app/settings/billing"
              className="mt-4 inline-flex min-h-10 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 transition hover:border-zinc-500"
            >
              Open Billing Settings
            </Link>
          </section>
        </main>
      </LifeOSBackground>
    );
  }

  const [order, entitlement] = await Promise.all([
    getBillingOrderForUser(userId, orderId),
    getUserEntitlement(userId),
  ]);
  const initialOrder = order
    ? {
        id: order.id,
        status: order.status,
        amount: order.amount.toString(),
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        paidAt: order.paidAt ? order.paidAt.toISOString() : null,
        payment: order.payment
          ? {
              status: order.payment.status,
              actuallyPaid: order.payment.actuallyPaid
                ? order.payment.actuallyPaid.toString()
                : null,
              confirmedAt: order.payment.confirmedAt
                ? order.payment.confirmedAt.toISOString()
                : null,
            }
          : null,
      }
    : null;

  return (
    <LifeOSBackground>
      <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 text-zinc-100 sm:px-6">
        <BillingStatusClient
          orderId={orderId}
          initialOrder={initialOrder}
          initialLicense={{
            active: isOperatorActive(entitlement),
            status: entitlement?.status ?? null,
            expiresAt: entitlement?.expiresAt ? entitlement.expiresAt.toISOString() : null,
          }}
        />
      </main>
    </LifeOSBackground>
  );
}
