"use client";

type WorkoutToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function WorkoutToggle({ checked, onChange }: WorkoutToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-zinc-200">Workout</p>
        <p className="text-xs text-zinc-500">Completed today</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative h-7 w-12 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
          checked ? "border-emerald-400 bg-emerald-500/25" : "border-zinc-700 bg-zinc-900",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-zinc-200 transition",
            checked ? "left-6 bg-emerald-300" : "left-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
