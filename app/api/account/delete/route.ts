import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiError } from "@/lib/api/errors";
import { requireWritableMode } from "@/lib/demoMode";
import { generateErrorId, logSystemError } from "@/lib/obs";
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
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const result = await deleteAccountData(userId);
    recordEvent("account_deleted");
    return NextResponse.json({ ok: true, data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
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
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
