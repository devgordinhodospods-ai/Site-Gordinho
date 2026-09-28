"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/** Números de página a mostrar: sempre a 1ª, a última e as vizinhas da atual. */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const go = (p: number) => {
    onChange(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const base = "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition";

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1" aria-label="Paginação">
      <button
        type="button"
        className={`${base} text-slate-500 hover:bg-blue-50 hover:text-brand disabled:opacity-30`}
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
      >
        <ChevronLeft size={18} />
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${base} ${
              p === page ? "bg-brand text-white shadow-brand" : "text-slate-600 hover:bg-blue-50 hover:text-brand"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        className={`${base} text-slate-500 hover:bg-blue-50 hover:text-brand disabled:opacity-30`}
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        aria-label="Próxima página"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
