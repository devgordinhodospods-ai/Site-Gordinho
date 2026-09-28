"use client";

export type Period = "30d" | "6m" | "all";

const OPTIONS: { value: Period; label: string }[] = [
  { value: "30d", label: "Últimos 30 dias" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "all", label: "Todos" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Só esconde da lista — nenhum pedido é apagado. */
export function isWithinPeriod(isoDate: string, period: Period) {
  if (period === "all") return true;
  const days = period === "30d" ? 30 : 182;
  return Date.now() - new Date(isoDate).getTime() <= days * DAY_MS;
}

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (value: Period) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition ${
            value === option.value
              ? "border-brand bg-brand text-white shadow-brand"
              : "border-blue-100 bg-white text-slate-600 hover:border-brand hover:text-brand"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
