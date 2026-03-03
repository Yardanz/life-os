import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { auth } from "@/auth";
import { ensureUserWithPlan, isPro } from "@/lib/api/plan";
import { ApiError } from "@/lib/api/errors";
import { requireWritableMode } from "@/lib/demoMode";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { generateProtocol } from "@/lib/protocol/protocolRuns";
import { recordEvent } from "@/lib/telemetry";

const generateProtocolSchema = z.object({
  horizonHours: z.union([z.literal(24), z.literal(48), z.literal(72)]),
  mode: z.enum(["STANDARD", "STABILIZE"]).optional().default("STANDARD"),
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

    const payload = generateProtocolSchema.parse(await request.json());
    const user = await ensureUserWithPlan(userId, request);
    const needsPro = payload.horizonHours > 24 || payload.mode === "STABILIZE";
    if (needsPro && !isPro(user)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Extension layer: forward simulation & scenarios",
        },
        { status: 403 }
      );
    }
    const run = await generateProtocol(userId, payload.horizonHours, payload.mode);
    recordEvent("protocol_generated");
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
      name: "api.protocol.generate.POST",
      message: error instanceof Error ? error.message : "Failed to generate protocol.",
      userId: logUserId,
      path: "/api/protocol/generate",
      meta: { method: "POST" },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
