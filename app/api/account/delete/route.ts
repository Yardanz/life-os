import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiError } from "@/lib/api/errors";
import { requireWritableMode } from "@/lib/demoMode";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { rateLimit } from "@/lib/rateLimit";
import { deleteAccountData } from "@/lib/setup/userSetup";
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

    const limiter = rateLimit(`account-delete:${userId}`, {
      windowMs: 60_000,
      max: 2,
    });
    if (!limiter.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "RATE_LIMITED",
          message: "Too many delete attempts. Try again shortly.",
          retryAfterMs: limiter.retryAfterMs ?? 0,
        },
        { status: 429 }
      );
    }

    const result = await deleteAccountData(userId);
    recordEvent("account_deleted");
    return NextResponse.json(
      { ok: true, message: "Account deleted successfully.", data: result },
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
      name: "api.account.delete.POST",
      message: error instanceof Error ? error.message : "Failed to delete account.",
      userId: logUserId,
      path: "/api/account/delete",
      meta: { method: "POST" },
    });
    return NextResponse.json(
      { ok: false, error: "SYSTEM_FAULT", errorId, message: "Failed to delete account." },
      { status: 500 }
    );
  }
}
