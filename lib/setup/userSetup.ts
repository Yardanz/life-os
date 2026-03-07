import { prisma } from "@/lib/prisma";

function toConfidence(done: number, needed: number): number {
  if (needed <= 0) return 1;
  return Math.max(0, Math.min(1, done / needed));
}

export type UserSetupState = {
  onboardingCompleted: boolean;
  welcomeModalSeen: boolean;
  totalCheckins: number;
  onboardingProgressCheckins: number;
  calibrationCheckinsDone: number;
  calibrationCheckinsNeeded: number;
  confidence: number;
  confidencePct: number;
};

export type ResetUserDataResult = {
  dailyCheckIns: number;
  statSnapshots: number;
  statContributions: number;
  bioStateSnapshots: number;
  xpEvents: number;
  levelSnapshots: number;
  userAchievements: number;
  antiChaosPlans: number;
  scenarioSnapshots: number;
  protocolRuns: number;
  systemSnapshots: number;
  billingPaymentEvents: number;
  billingOrders: number;
};

export type DeleteAccountResult = {
  dailyCheckIns: number;
  statSnapshots: number;
  statContributions: number;
  bioStateSnapshots: number;
  xpEvents: number;
  levelSnapshots: number;
  userAchievements: number;
  antiChaosPlans: number;
  scenarioSnapshots: number;
  protocolRuns: number;
  systemSnapshots: number;
  billingPaymentEvents: number;
  billingOrders: number;
  entitlements: number;
  sessions: number;
  accounts: number;
  verificationTokens: number;
  accountDeleted: boolean;
};

export async function getUserSetupState(userId: string): Promise<UserSetupState> {
  const [user, checkinsCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        onboardingCompleted: true,
        welcomeModalSeen: true,
        calibrationCheckinsDone: true,
        calibrationCheckinsNeeded: true,
      },
    }),
    prisma.dailyCheckIn.count({ where: { userId } }),
  ]);

  if (!user) {
    throw new Error("User not found for setup state.");
  }

  // Real completed count: unbounded, used for all non-onboarding logic.
  const totalDone = Math.max(0, checkinsCount);
  const needed = Math.max(1, user.calibrationCheckinsNeeded);
  // Onboarding progress only: bounded for Day 1/3/5/7 milestone UI.
  const onboardingProgressCheckins = Math.max(0, Math.min(needed, totalDone));
  const confidence = toConfidence(onboardingProgressCheckins, needed);

  return {
    onboardingCompleted: user.onboardingCompleted,
    welcomeModalSeen: user.welcomeModalSeen,
    totalCheckins: totalDone,
    onboardingProgressCheckins,
    calibrationCheckinsDone: totalDone,
    calibrationCheckinsNeeded: needed,
    confidence,
    confidencePct: Math.round(confidence * 100),
  };
}

export async function completeOnboarding(userId: string): Promise<UserSetupState> {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
  });
  return getUserSetupState(userId);
}

export async function completeWelcomeModal(userId: string): Promise<UserSetupState> {
  await prisma.user.update({
    where: { id: userId },
    data: { welcomeModalSeen: true },
  });
  return getUserSetupState(userId);
}

export async function incrementCalibrationCheckins(userId: string): Promise<UserSetupState> {
  const [checkinsCount, user] = await Promise.all([
    prisma.dailyCheckIn.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { calibrationCheckinsNeeded: true },
    }),
  ]);

  if (!user) {
    throw new Error("User not found for calibration update.");
  }

  const nextDone = Math.max(0, checkinsCount);

  await prisma.user.update({
    where: { id: userId },
    data: {
      calibrationCheckinsDone: nextDone,
    },
  });

  return getUserSetupState(userId);
}

export async function resetUserData(userId: string): Promise<ResetUserDataResult> {
  const result = await prisma.$transaction(async (tx) => {
    const [
      dailyCheckIns,
      statContributions,
      statSnapshots,
      bioStateSnapshots,
      xpEvents,
      levelSnapshots,
      userAchievements,
      antiChaosPlans,
      scenarioSnapshots,
      protocolRuns,
      systemSnapshots,
      billingPaymentEvents,
      billingOrders,
    ] = await Promise.all([
      tx.dailyCheckIn.deleteMany({ where: { userId } }),
      tx.statContribution.deleteMany({ where: { userId } }),
      tx.statSnapshot.deleteMany({ where: { userId } }),
      tx.bioStateSnapshot.deleteMany({ where: { userId } }),
      tx.xpEvent.deleteMany({ where: { userId } }),
      tx.levelSnapshot.deleteMany({ where: { userId } }),
      tx.userAchievement.deleteMany({ where: { userId } }),
      tx.antiChaosPlan.deleteMany({ where: { userId } }),
      tx.scenarioSnapshot.deleteMany({ where: { userId } }),
      tx.protocolRun.deleteMany({ where: { userId } }),
      tx.systemSnapshot.deleteMany({ where: { userId } }),
      tx.billingPaymentEvent.deleteMany({ where: { order: { userId } } }),
      tx.billingOrder.deleteMany({ where: { userId } }),
    ]);

    await tx.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: false,
        welcomeModalSeen: false,
        calibrationCheckinsDone: 0,
        calibrationCheckinsNeeded: 7,
        adaptiveRiskOffset: 0,
        adaptiveRecoveryOffset: 0,
      },
    });

    return {
      dailyCheckIns: dailyCheckIns.count,
      statSnapshots: statSnapshots.count,
      statContributions: statContributions.count,
      bioStateSnapshots: bioStateSnapshots.count,
      xpEvents: xpEvents.count,
      levelSnapshots: levelSnapshots.count,
      userAchievements: userAchievements.count,
      antiChaosPlans: antiChaosPlans.count,
      scenarioSnapshots: scenarioSnapshots.count,
      protocolRuns: protocolRuns.count,
      systemSnapshots: systemSnapshots.count,
      billingPaymentEvents: billingPaymentEvents.count,
      billingOrders: billingOrders.count,
    };
  });

  return result;
}

export async function deleteAccountData(userId: string): Promise<DeleteAccountResult> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      throw new Error("User not found for account deletion.");
    }

    const [
      dailyCheckIns,
      statContributions,
      statSnapshots,
      bioStateSnapshots,
      xpEvents,
      levelSnapshots,
      userAchievements,
      antiChaosPlans,
      scenarioSnapshots,
      protocolRuns,
      systemSnapshots,
      billingPaymentEvents,
      entitlements,
      billingOrders,
      sessions,
      accounts,
      verificationTokens,
    ] = await Promise.all([
      tx.dailyCheckIn.deleteMany({ where: { userId } }),
      tx.statContribution.deleteMany({ where: { userId } }),
      tx.statSnapshot.deleteMany({ where: { userId } }),
      tx.bioStateSnapshot.deleteMany({ where: { userId } }),
      tx.xpEvent.deleteMany({ where: { userId } }),
      tx.levelSnapshot.deleteMany({ where: { userId } }),
      tx.userAchievement.deleteMany({ where: { userId } }),
      tx.antiChaosPlan.deleteMany({ where: { userId } }),
      tx.scenarioSnapshot.deleteMany({ where: { userId } }),
      tx.protocolRun.deleteMany({ where: { userId } }),
      tx.systemSnapshot.deleteMany({ where: { userId } }),
      tx.billingPaymentEvent.deleteMany({ where: { order: { userId } } }),
      tx.entitlement.deleteMany({ where: { userId } }),
      tx.billingOrder.deleteMany({ where: { userId } }),
      tx.session.deleteMany({ where: { userId } }),
      tx.account.deleteMany({ where: { userId } }),
      user.email
        ? tx.verificationToken.deleteMany({
            where: { identifier: user.email },
          })
        : Promise.resolve({ count: 0 }),
    ]);

    await tx.user.delete({
      where: { id: userId },
    });

    return {
      dailyCheckIns: dailyCheckIns.count,
      statSnapshots: statSnapshots.count,
      statContributions: statContributions.count,
      bioStateSnapshots: bioStateSnapshots.count,
      xpEvents: xpEvents.count,
      levelSnapshots: levelSnapshots.count,
      userAchievements: userAchievements.count,
      antiChaosPlans: antiChaosPlans.count,
      scenarioSnapshots: scenarioSnapshots.count,
      protocolRuns: protocolRuns.count,
      systemSnapshots: systemSnapshots.count,
      billingPaymentEvents: billingPaymentEvents.count,
      billingOrders: billingOrders.count,
      entitlements: entitlements.count,
      sessions: sessions.count,
      accounts: accounts.count,
      verificationTokens: verificationTokens.count,
      accountDeleted: true,
    };
  });
}
