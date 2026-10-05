"use client";

import Image from "next/image";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Droplets, Search } from "lucide-react";
import type { ProductFlavor } from "@/lib/types";

export type FlavorSelectHandle = { open: () => void };

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Lista de sabores que abre ao clicar (em vez de um monte de botões soltos). */
export const FlavorSelect = forwardRef<
  FlavorSelectHandle,
  {
    flavors: ProductFlavor[];
    value: string | null;
    onChange: (id: string) => void;
    highlight?: boolean;
  }
>(function FlavorSelect({ flavors, value, onChange, highlight = false }, ref) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = flavors.find((f) => f.id === value) ?? null;
  const available = flavors.filter((f) => f.stock > 0).length;
  const showSearch = flavors.length > 8;

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  }));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    // No computador já dá pra digitar o sabor; no celular não abre o teclado sozinho.
    if (showSearch && window.matchMedia("(pointer: fine)").matches) searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, showSearch]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return q ? flavors.filter((f) => normalize(f.name).includes(q)) : flavors;
  }, [flavors, query]);

  function choose(f: ProductFlavor) {
    if (f.stock <= 0) return;
    onChange(f.id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <p className="mb-2 text-sm font-bold text-slate-700">Sabor:</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-xl border-2 bg-white px-3 py-2.5 text-left transition-colors ${
          open || selected ? "border-brand" : highlight ? "border-amber-400" : "border-slate-200 hover:border-brand"
        }`}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-50 text-brand">
          {selected?.image_url ? (
            <Image src={selected.image_url} alt="" fill className="object-cover" sizes="36px" />
          ) : (
            <Droplets size={18} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${selected ? "text-slate-900" : "text-slate-500"}`}>
            {selected ? selected.name : "Escolha o sabor"}
          </span>
          <span className="block text-xs text-slate-400">
            {selected
              ? `${selected.stock} em estoque`
              : `${available} ${available === 1 ? "sabor disponível" : "sabores disponíveis"}`}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-blue-100 bg-white shadow-xl">
          {showSearch && (
            <div className="relative border-b border-blue-50 p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                ref={searchRef}
                className="input py-2 pl-8 text-sm"
                placeholder="Buscar sabor..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {visible.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Nenhum sabor com esse nome.</li>}
            {visible.map((f) => {
              const out = f.stock <= 0;
              const isSelected = f.id === value;
              return (
                <li key={f.id} role="option" aria-selected={isSelected} aria-disabled={out}>
                  <button
                    type="button"
                    disabled={out}
                    onClick={() => choose(f)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      out
                        ? "cursor-not-allowed text-slate-300"
                        : isSelected
                          ? "bg-blue-50 text-brand"
                          : "text-slate-700 hover:bg-blue-50"
                    }`}
                  >
                    <span className={`min-w-0 flex-1 truncate ${out ? "line-through" : ""}`}>{f.name}</span>
                    {out ? (
                      <span className="shrink-0 text-xs">Esgotado</span>
                    ) : isSelected ? (
                      <Check size={16} className="shrink-0" />
                    ) : (
                      <span className="shrink-0 text-xs text-slate-400">{f.stock} un.</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
});
