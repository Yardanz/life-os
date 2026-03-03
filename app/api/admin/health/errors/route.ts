import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getRecentSystemErrors } from "@/lib/obs";
import { parseHealthWindow } from "@/lib/admin/healthConsole";

export const runtime = "nodejs";

function asCsv(rows: ReturnType<typeof getRecentSystemErrors>): string {
  const header = ["timestamp", "errorId", "scope", "name", "path", "message"];
  const lines = [header.join(",")];
  for (const row of rows) {
    const cols = [row.ts, row.errorId, row.scope, row.name, row.path ?? "", row.message].map((value) =>
      `"${String(value).replace(/"/g, '""')}"`
    );
    lines.push(cols.join(","));
  }
  return lines.join("\n");
}

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const format = (url.searchParams.get("format") ?? "json").toLowerCase();
    const window = parseHealthWindow(url.searchParams.get("window"));
    const now = new Date();
    const since =
      window === "7d"
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const rows = getRecentSystemErrors({ since, limit: 1000 });
    const day = now.toISOString().slice(0, 10);
    if (format === "csv") {
      const csv = asCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename=\"lifeos_admin_errors_${window}_${day}.csv\"`,
        },
      });
    }

    if (format !== "json") {
      return NextResponse.json({ ok: false, error: "Invalid format" }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        meta: {
          window,
          exportedAt: now.toISOString(),
          note: "In-memory process buffer (resets on process restart).",
        },
        errors: rows,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename=\"lifeos_admin_errors_${window}_${day}.json\"`,
        },
      }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "Not Found" }, { status: 404 });
  }
}

