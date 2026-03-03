import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { isDemoModeRequest, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { getUserSetupState } from "@/lib/setup/userSetup";

export async function GET(request: Request) {
  try {
    const demoMode = isDemoModeRequest(request);
    const session = await auth();
    const userId = demoMode ? LIVE_DEMO_USER_ID : session?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (demoMode) {
      await ensureLiveDemoData();
    }

    const state = await getUserSetupState(userId);
    return NextResponse.json({ ok: true, data: state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load setup state.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
