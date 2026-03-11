import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { completeWelcomeModal } from "@/lib/setup/userSetup";

export async function POST() {
  let logUserId: string | null = null;
  try {
    const session = await auth();
    const userId = session?.user?.id;
    logUserId = userId ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const state = await completeWelcomeModal(userId);
    return NextResponse.json({ ok: true, data: state });
  } catch (error) {
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.setup.complete-welcome.POST",
      message: error instanceof Error ? error.message : "Failed to complete welcome flow.",
      userId: logUserId,
      path: "/api/setup/complete-welcome",
      meta: { method: "POST" },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
