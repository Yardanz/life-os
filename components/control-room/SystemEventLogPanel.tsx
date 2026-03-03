"use client";

import { useMemo, useState } from "react";
import { PanelState } from "@/components/control-room/PanelState";

export type SystemEventLogItem = {
  id: string;
  timestamp: string;
  source: "checkin" | "protocol" | "integrity";
  type:
    | "CHECK_IN_RECORDED"
    | "PROTOCOL_GENERATED"
    | "PROTOCOL_APPLIED"
    | "GUARDRAIL_TRANSITION"
    | "INTEGRITY_TRANSITION";
  message: string;
  status?: "COMPLETED" | "GENERATED" | "APPLIED";
};

type SystemEventLogPanelProps = {
  events: SystemEventLogItem[];
  loading: boolean;
  error: string | null;
  zeroDataState?: boolean;
  filter?: Filter;
  onFilterChange?: (filter: Filter) => void;
};

export type Filter = "all" | "checkin" | "protocol" | "integrity";

function statusClass(status?: string): string {
  if (status === "APPLIED") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (status === "GENERATED") return "border-cyan-500/40 bg-cyan-500/10 text-cyan-100";
  if (status === "COMPLETED") return "border-zinc-600 bg-zinc-800/60 text-zinc-200";
  return "border-zinc-700 bg-zinc-900/60 text-zinc-300";
}

export function SystemEventLogPanel({
  events,
  loading,
  error,
  zeroDataState = false,
  filter,
  onFilterChange,
}: SystemEventLogPanelProps) {
  const [internalFilter, setInternalFilter] = useState<Filter>("all");
  const activeFilter = filter ?? internalFilter;
  const setActiveFilter = onFilterChange ?? setInternalFilter;

  const visibleEvents = useMemo(() => {
    if (activeFilter === "all") return events;
    if (activeFilter === "integrity") {
      return events.filter((item) => item.type.includes("INTEGRITY") || item.source === "integrity");
    }
    return events.filter((item) => item.source === activeFilter);
  }, [activeFilter, events]);

  return (
    <section id="system-event-log" className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-zinc-200">System Event Log</h3>
        <div className="inline-flex rounded-md border border-zinc-700 bg-zinc-950 p-0.5 text-xs">
          {([
            { key: "all", label: "All" },
            { key: "checkin", label: "Check-ins" },
            { key: "protocol", label: "Protocol" },
            { key: "integrity", label: "Integrity" },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveFilter(item.key)}
              className={`min-h-9 rounded px-2.5 py-1 transition ${
                activeFilter === item.key ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <PanelState kind="loading" title="Loading..." />
      ) : error ? (
        <PanelState kind="error" title="Data unavailable." subtitle={error} />
      ) : visibleEvents.length === 0 ? (
        activeFilter === "integrity" ? (
          <PanelState kind="empty" title="Integrity events unavailable in log." />
        ) : zeroDataState ? (
          <ul className="mt-3 space-y-1.5">
            <li className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">{new Date().toLocaleString()}</span>
                <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusClass("COMPLETED")}`}>
                  COMPLETED
                </span>
              </div>
              <p className="mt-1 break-words text-xs font-medium text-zinc-200">SYSTEM_INITIALIZED</p>
              <p className="mt-1 break-words text-xs text-zinc-400">System initialized. Awaiting first check-in.</p>
            </li>
          </ul>
        ) : (
          <PanelState kind="empty" title="No recent system events." />
        )
      ) : (
        <ul className="mt-3 space-y-1.5">
          {visibleEvents.map((event) => (
            <li key={event.id} className="rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">{new Date(event.timestamp).toLocaleString()}</span>
                {event.status ? (
                  <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusClass(event.status)}`}>
                    {event.status}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 break-words text-xs font-medium text-zinc-200">{event.type}</p>
              <p className="mt-1 break-words text-xs text-zinc-400">{event.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


