import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiError } from "@/lib/api/errors";
import { createInvoiceOrder } from "@/lib/billing/service";
import { requireWritableMode } from "@/lib/demoMode";
import { generateErrorId, logSystemError } from "@/lib/obs";

const schema = z.object({
  planCode: z.enum(["OPERATOR_MONTHLY", "OPERATOR_YEARLY"]),
});

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
    const payload = schema.parse(await request.json());
    const data = await createInvoiceOrder(userId, payload.planCode);
    return NextResponse.json({ ok: true, data }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.billing.create-invoice.POST",
      message: error instanceof Error ? error.message : "Failed to create billing invoice.",
      userId: logUserId,
      path: "/api/billing/create-invoice",
      meta: { method: "POST" },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}

