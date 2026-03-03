import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { completeOnboarding } from "@/lib/setup/userSetup";

export async function POST() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const state = await completeOnboarding(userId);
    return NextResponse.json({ ok: true, data: state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete onboarding.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
