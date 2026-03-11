import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { incrementCalibrationCheckins } from "@/lib/setup/userSetup";

export async function POST() {
  let logUserId: string | null = null;
  try {
    const session = await auth();
    const userId = session?.user?.id;
    logUserId = userId ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const state = await incrementCalibrationCheckins(userId);
    return NextResponse.json({ ok: true, data: state });
  } catch (error) {
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.setup.increment-calibration.POST",
      message: error instanceof Error ? error.message : "Failed to increment calibration check-ins.",
      userId: logUserId,
      path: "/api/setup/increment-calibration",
      meta: { method: "POST" },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
