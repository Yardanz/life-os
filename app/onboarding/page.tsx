import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";
import { getUserSetupState } from "@/lib/setup/userSetup";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin?callbackUrl=/onboarding");
  }

  const setupState = await getUserSetupState(userId);
  if (setupState.onboardingCompleted) {
    redirect("/app");
  }

  return (
    <LifeOSBackground>
      <OnboardingWizard userEmail={session.user?.email ?? null} />
    </LifeOSBackground>
  );
}
