import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { parseISODateParam, formatISODate, getLocalISODate } from "@/lib/date/localDate";
import type { ProtocolObject } from "@/lib/engine/protocolRules";
import { prisma } from "@/lib/prisma";
import { fetchActiveProtocol } from "@/lib/protocol/fetchActiveProtocol";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { DEMO_MODE_COOKIE, DEMO_MODE_COOKIE_VALUE, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { canAccessApp } from "@/lib/softLaunch";
import { ControlRoomDashboard } from "@/components/control-room/ControlRoomDashboard";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";

type AppControlRoomPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppControlRoomPage({ searchParams }: AppControlRoomPageProps) {
  const session = await auth();
  const cookieStore = await cookies();
  const demoMode = cookieStore.get(DEMO_MODE_COOKIE)?.value === DEMO_MODE_COOKIE_VALUE;
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/app");
  }

  if (
    !canAccessApp({
      user: {
        email: session.user.email ?? null,
        role: (session.user as { role?: string | null }).role ?? null,
      },
    })
  ) {
    redirect("/restricted");
  }

  if (demoMode) {
    await ensureLiveDemoData();
  }
  const effectiveUserId = demoMode ? LIVE_DEMO_USER_ID : (session?.user?.id as string);

  const params = (await searchParams) ?? {};
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const explicitDate = parseISODateParam(rawDate);

  const [latestCheckin, activeProtocol] = await Promise.all([
    prisma.dailyCheckIn.findFirst({
      where: { userId: effectiveUserId },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
    fetchActiveProtocol(effectiveUserId),
  ]);

  const latestCheckinDate = latestCheckin ? formatISODate(latestCheckin.date) : null;
  const initialSelectedDate = explicitDate ?? latestCheckinDate ?? getLocalISODate();
  const appVersion = process.env.VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
  const supportEmail = process.env.SUPPORT_EMAIL ?? process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? null;
  const initialActiveProtocol = activeProtocol
      ? {
        id: activeProtocol.id,
        createdAt: activeProtocol.createdAt.toISOString(),
        horizonHours: activeProtocol.horizonHours,
        mode: activeProtocol.mode,
        guardrailState: activeProtocol.guardrailState,
        confidence: activeProtocol.confidence,
        inputs: activeProtocol.inputs,
        protocol: activeProtocol.protocol as ProtocolObject,
        appliedAt: activeProtocol.appliedAt ? activeProtocol.appliedAt.toISOString() : null,
        outcome: activeProtocol.outcome as
          | {
              riskDelta?: number;
              recoveryDelta?: number;
              loadDelta?: number;
              guardrailAtApply?: string;
              guardrailNow?: string;
            }
          | null,
        integrityAtEnd: activeProtocol.integrityAtEnd as
          | {
              finalScore?: number;
              finalState?: "STABLE" | "DRIFT" | "STRAIN" | string;
            }
          | null,
      }
    : null;

  return (
    <LifeOSBackground>
      <Suspense fallback={null}>
        <ControlRoomDashboard
          userId={effectiveUserId}
          userEmail={demoMode ? null : (session?.user?.email ?? null)}
          demoMode={demoMode}
          appVersion={appVersion}
          supportEmail={supportEmail}
          initialSelectedDate={initialSelectedDate}
          latestCheckinDate={latestCheckinDate}
          initialActiveProtocol={initialActiveProtocol}
        />
      </Suspense>
    </LifeOSBackground>
  );
}
