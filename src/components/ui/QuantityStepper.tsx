"use client";

import { Minus, Plus } from "lucide-react";

export function QuantityStepper({
  value,
  min = 1,
  max,
  disabled,
  size = "md",
  onChange,
}: {
  value: number;
  min?: number;
  max: number;
  disabled?: boolean;
  size?: "sm" | "md";
  onChange: (value: number) => void;
}) {
  const box = size === "sm" ? "h-8 w-8" : "h-11 w-10";

  return (
    <div className="inline-flex items-center rounded-xl border-2 border-blue-100 bg-white">
      <button
        type="button"
        className={`${box} flex items-center justify-center text-brand transition hover:bg-blue-50 disabled:text-slate-300`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Diminuir quantidade"
      >
        <Minus size={14} />
      </button>
      <span className={`${size === "sm" ? "w-7 text-sm" : "w-8"} text-center text-slate-900`}>{value}</span>
      <button
        type="button"
        className={`${box} flex items-center justify-center text-brand transition hover:bg-blue-50 disabled:text-slate-300`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Aumentar quantidade"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
