import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { isDemoModeRequest, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { getUserSetupState } from "@/lib/setup/userSetup";

export async function GET(request: Request) {
  let logUserId: string | null = null;
  try {
    const demoMode = isDemoModeRequest(request);
    const session = await auth();
    const userId = demoMode ? LIVE_DEMO_USER_ID : session?.user?.id;
    logUserId = userId ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (demoMode) {
      await ensureLiveDemoData();
    }

    const state = await getUserSetupState(userId);
    return NextResponse.json({ ok: true, data: state });
  } catch (error) {
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.setup.state.GET",
      message: error instanceof Error ? error.message : "Failed to load setup state.",
      userId: logUserId,
      path: "/api/setup/state",
      meta: { method: "GET" },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
