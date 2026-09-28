"use client";

import { useState } from "react";
import { ProductCard } from "@/components/loja/ProductCard";
import type { Category, ProductWithFlavors } from "@/lib/types";

export function HomeCatalog({
  categories,
  products,
}: {
  categories: Category[];
  products: ProductWithFlavors[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = categories.find((c) => c.id === selectedId) ?? null;
  const visible = selected ? products.filter((p) => p.category_id === selected.id) : products;

  const chipClass = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
      active
        ? "border-brand bg-brand text-white shadow-brand"
        : "border-blue-100 bg-white text-slate-700 hover:border-brand hover:text-brand"
    }`;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      {categories.length > 0 && (
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
          <button type="button" className={chipClass(selectedId === null)} onClick={() => setSelectedId(null)}>
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={chipClass(selectedId === cat.id)}
              onClick={() => setSelectedId(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <h2 className="font-display mb-4 text-xl text-slate-900">{selected ? selected.name : "Novidades"}</h2>

      {visible.length === 0 ? (
        <p className="text-slate-500">
          {selected
            ? "Nenhum produto nessa categoria ainda."
            : "Nenhum produto cadastrado ainda. Acesse o painel administrativo para começar a montar o catálogo."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
