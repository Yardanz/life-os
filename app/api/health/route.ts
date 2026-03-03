import { NextResponse } from "next/server";
import { SYSTEM_VERSION } from "@/lib/version";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "life-os",
      version: SYSTEM_VERSION,
      ts: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
