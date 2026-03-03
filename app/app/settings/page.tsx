import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { prisma } from "@/lib/prisma";
import { SettingsPanel } from "@/app/app/settings/SettingsPanel";
import { isAdmin } from "@/lib/authz";

type ProviderLabel = "Google" | "GitHub" | "OAuth" | "Unknown";

function mapProviderLabel(provider?: string | null): ProviderLabel {
  if (!provider) return "Unknown";
  if (provider === "google") return "Google";
  if (provider === "github") return "GitHub";
  return "OAuth";
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/app/settings");
  }

  const user = await prisma.user.findUnique({
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
  });

  return (
    <LifeOSBackground>
      <SettingsPanel
        plan={user?.plan ?? "FREE"}
        providerLabel={mapProviderLabel(user?.accounts[0]?.provider)}
        isAdmin={isAdmin({ role: user?.role, email: user?.email })}
      />
    </LifeOSBackground>
  );
}
