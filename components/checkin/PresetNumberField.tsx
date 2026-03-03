"use client";

import { useState } from "react";

type PresetNumberFieldProps = {
  id: string;
  label: string;
  value: number;
  presets: number[];
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
};

export function PresetNumberField({
  id,
  label,
  value,
  presets,
  min = 0,
  max,
  step = 1,
  onChange,
}: PresetNumberFieldProps) {
  const [customValue, setCustomValue] = useState<string>(String(Number.isFinite(value) ? value : 0));
  const [isEditing, setIsEditing] = useState(false);

  const sanitizeToStep = (raw: string): number => {
    const parsed = Number.parseInt(raw, 10);
    const minBound = min;
    const maxBound = typeof max === "number" ? max : Number.MAX_SAFE_INTEGER;
    const normalized = Number.isFinite(parsed) ? parsed : minBound;
    const clamped = Math.min(maxBound, Math.max(minBound, normalized));
    const stepped = step > 1 ? Math.round(clamped / step) * step : clamped;
    return Math.min(maxBound, Math.max(minBound, stepped));
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-zinc-200">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active = value === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={[
                "rounded-md border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                active
                  ? "border-emerald-400 bg-emerald-400/15 text-emerald-200"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500",
              ].join(" ")}
              aria-pressed={active}
            >
              {preset}
            </button>
          );
        })}
      </div>

      <div>
        <label htmlFor={id} className="mb-1 block text-xs text-zinc-400">
          Custom
        </label>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          inputMode="numeric"
          pattern="[0-9]*"
          value={isEditing ? customValue : String(Number.isFinite(value) ? value : 0)}
          onFocus={() => {
            setIsEditing(true);
            setCustomValue(String(Number.isFinite(value) ? value : 0));
          }}
          onChange={(event) => {
            const nextRaw = event.target.value;
            if (nextRaw === "") {
              setCustomValue("");
              return;
            }

            if (!/^\d+$/.test(nextRaw)) {
              return;
            }

            setCustomValue(nextRaw.replace(/^0+(?=\d)/, ""));
          }}
          onBlur={() => {
            setIsEditing(false);
            const raw = customValue.trim();
            if (raw === "") {
              setCustomValue("0");
              onChange(0);
              return;
            }

            const sanitized = sanitizeToStep(raw);
            setCustomValue(String(sanitized));
            onChange(sanitized);
          }}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
        />
      </div>
    </fieldset>
  );
}
