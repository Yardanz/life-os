import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { errorResponse } from "@/lib/api/errors";
import { getSnapshot } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
    }
    await requireAdmin();

    return NextResponse.json(
      {
        ok: true,
        data: getSnapshot(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
