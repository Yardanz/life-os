import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { auth } from "@/auth";
import { ApiError } from "@/lib/api/errors";
import { requireWritableMode } from "@/lib/demoMode";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { applyProtocol } from "@/lib/protocol/protocolRuns";
import { recordEvent } from "@/lib/telemetry";

const applyProtocolSchema = z.object({
  protocolRunId: z.string().min(1),
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

    const payload = applyProtocolSchema.parse(await request.json());
    const run = await applyProtocol(payload.protocolRunId, userId);
    recordEvent("protocol_applied");
    return NextResponse.json({ ok: true, data: run }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.protocol.apply.POST",
      message: error instanceof Error ? error.message : "Failed to apply protocol.",
      userId: logUserId,
      path: "/api/protocol/apply",
      meta: { method: "POST" },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
