import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/auth";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { prisma } from "@/lib/prisma";
import { SettingsPanel } from "@/app/app/settings/SettingsPanel";
import { isAdmin } from "@/lib/authz";
import { ensureUserWithPlan } from "@/lib/api/plan";

export const dynamic = "force-dynamic";

type ProviderLabel = "Google" | "GitHub" | "OAuth" | "Unknown";

function mapProviderLabel(provider?: string | null): ProviderLabel {
  if (!provider) return "Unknown";
  if (provider === "google") return "Google";
  if (provider === "github") return "GitHub";
  return "OAuth";
}

export default async function SettingsPage() {
  noStore();
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/app/settings");
  }

  const [user, resolvedUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        plan: true,
        role: true,
        email: true,
        accounts: {
          select: { provider: true },
          take: 1,
          orderBy: { id: "asc" },
        },
      },
    }),
    ensureUserWithPlan(session.user.id),
  ]);

  const debugPlan =
    process.env.NODE_ENV !== "production"
      ? {
          userId: session.user.id,
          email: user?.email ?? session.user.email ?? null,
          dbPlan: user?.plan ?? "FREE",
          sessionPlan: session.user.plan ?? null,
          resolvedPlan: resolvedUser.plan,
        }
      : null;

  return (
    <LifeOSBackground>
      <SettingsPanel
        plan={resolvedUser.plan}
        providerLabel={mapProviderLabel(user?.accounts[0]?.provider)}
        isAdmin={isAdmin({ role: user?.role, email: user?.email })}
        debugPlan={debugPlan}
      />
    </LifeOSBackground>
  );
}
