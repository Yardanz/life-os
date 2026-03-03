import { NextResponse } from "next/server";
import { PLAN_OVERRIDE_COOKIE } from "@/lib/api/plan";
import { requireAdmin } from "@/lib/authz";
import { ApiError, errorResponse } from "@/lib/api/errors";

function devToolsEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEV_TOOLS === "true";
}

export async function POST(request: Request) {
  try {
    if (!devToolsEnabled()) {
      throw new ApiError(404, "Not found");
    }
    await requireAdmin();

    const body = (await request.json()) as { plan?: string };
    const plan = body.plan?.toLowerCase();
    if (plan !== "free" && plan !== "pro") {
      throw new ApiError(400, "Invalid plan override. Use 'free' or 'pro'.");
    }

    const response = NextResponse.json(
      {
        ok: true,
        data: {
          plan,
        },
      },
      { status: 200 }
    );

    response.cookies.set({
      name: PLAN_OVERRIDE_COOKIE,
      value: plan,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      secure: false,
    });

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
