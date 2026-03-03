import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiError } from "@/lib/api/errors";
import { requireWritableMode } from "@/lib/demoMode";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { rateLimit } from "@/lib/rateLimit";
import { resetUserData } from "@/lib/setup/userSetup";
import { recordEvent } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let logUserId: string | null = null;
  try {
    requireWritableMode(request);
    const session = await auth();
    const userId = session?.user?.id;
    logUserId = userId ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized", message: "Authentication required." }, { status: 401 });
    }

    const limiter = rateLimit(`system-reset:${userId}`, {
      windowMs: 60_000,
      max: 3,
    });
    if (!limiter.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "RATE_LIMITED",
          message: "Too many reset attempts. Try again shortly.",
          retryAfterMs: limiter.retryAfterMs ?? 0,
        },
        { status: 429 }
      );
    }

    const result = await resetUserData(userId);
    recordEvent("system_reset");
    return NextResponse.json(
      { ok: true, message: "System reset complete. Baseline calibration restarted.", data: result },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ ok: false, error: error.message, message: error.message }, { status: error.status });
    }
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.setup.reset.POST",
      message: error instanceof Error ? error.message : "Failed to reset user data.",
      userId: logUserId,
      path: "/api/setup/reset",
      meta: { method: "POST" },
    });
    return NextResponse.json(
      { ok: false, error: "SYSTEM_FAULT", errorId, message: "Failed to reset system." },
      { status: 500 }
    );
  }
}
