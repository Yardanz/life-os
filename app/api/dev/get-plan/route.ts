import { NextResponse } from "next/server";
import { PLAN_OVERRIDE_COOKIE } from "@/lib/api/plan";
import { requireAdmin } from "@/lib/authz";
import { ApiError, errorResponse } from "@/lib/api/errors";

function devToolsEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEV_TOOLS === "true";
}

function parseOverride(cookieHeader: string | null): "free" | "pro" | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const pair = parts.find((part) => part.startsWith(`${PLAN_OVERRIDE_COOKIE}=`));
  if (!pair) return null;
  const value = pair.slice(PLAN_OVERRIDE_COOKIE.length + 1).toLowerCase();
  if (value === "free" || value === "pro") return value;
  return null;
}

export async function GET(request: Request) {
  try {
    if (!devToolsEnabled()) {
      throw new ApiError(404, "Not found");
    }
    await requireAdmin();

    const override = parseOverride(request.headers.get("cookie"));
    return NextResponse.json(
      {
        ok: true,
        data: {
          plan: override,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
