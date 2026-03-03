"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HealthWindow } from "@/lib/admin/healthConsole";

type HealthConsoleControlsProps = {
  initialWindow: HealthWindow;
};

export function HealthConsoleControls({ initialWindow }: HealthConsoleControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [windowValue, setWindowValue] = useState<HealthWindow>(initialWindow);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");

  const handleWindowChange = (nextWindow: HealthWindow) => {
    setWindowValue(nextWindow);
    const params = new URLSearchParams(searchParams.toString());
    params.set("window", nextWindow);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleRefresh = () => {
    router.refresh();
  };

  const handleExport = () => {
    const url = `/api/admin/health/errors?window=${windowValue}&format=${exportFormat}`;
    window.location.href = url;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs uppercase tracking-[0.16em] text-zinc-500">
        Data window
        <select
          value={windowValue}
          onChange={(event) => handleWindowChange(event.target.value as HealthWindow)}
          className="ml-2 min-h-9 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100 focus-visible:outline-none"
        >
          <option value="24h">24h</option>
          <option value="7d">7d</option>
        </select>
      </label>
      <button
        type="button"
        onClick={handleRefresh}
        className="min-h-9 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 transition hover:border-zinc-500"
      >
        Refresh
      </button>
      <label className="text-xs uppercase tracking-[0.16em] text-zinc-500">
        Export
        <select
          value={exportFormat}
          onChange={(event) => setExportFormat(event.target.value as "json" | "csv")}
          className="ml-2 min-h-9 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100 focus-visible:outline-none"
        >
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
        </select>
      </label>
      <button
        type="button"
        onClick={handleExport}
        className="min-h-9 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs text-cyan-100 transition hover:border-cyan-400/60"
      >
        Export errors
      </button>
    </div>
  );
}

