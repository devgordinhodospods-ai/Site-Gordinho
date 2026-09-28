"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/loja/ProductCard";
import { ProductCarousel } from "@/components/loja/ProductCarousel";
import { useSearchStore } from "@/store/search";
import type { Category, ProductWithFlavors } from "@/lib/types";

type Sort = "recent" | "price-asc" | "price-desc" | "discount";

const CAROUSEL_THRESHOLD = 8;

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function inStock(p: ProductWithFlavors) {
  const flavors = p.product_flavors ?? [];
  return flavors.length > 0 ? flavors.some((f) => f.stock > 0) : p.stock > 0;
}

export function HomeCatalog({
  categories,
  products,
  initialQuery = "",
  initialCategorySlug = "",
}: {
  categories: Category[];
  products: ProductWithFlavors[];
  initialQuery?: string;
  initialCategorySlug?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    categories.find((c) => c.slug === initialCategorySlug)?.id ?? null,
  );
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");
  // A busca vive num store compartilhado com a barra do topo. No 1º render
  // usa a da URL (?busca=), pra não piscar "Todos os produtos".
  const storeQuery = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const [synced, setSynced] = useState(false);
  const query = synced ? storeQuery : initialQuery;

  useEffect(() => {
    // Veio da barra do topo em outra página: o store já tem o texto (talvez
    // até mais letras digitadas durante a navegação) — não sobrescreve.
    const current = useSearchStore.getState().query;
    if (!initialQuery || !current) setQuery(initialQuery);
    setSynced(true);
  }, [initialQuery, setQuery]);

  // Ao começar a digitar (aqui ou no topo), a busca vale pro catálogo
  // inteiro — antes ela ficava presa na categoria selecionada.
  const hadQuery = useRef(Boolean(initialQuery.trim()));
  useEffect(() => {
    const has = Boolean(query.trim());
    if (has && !hadQuery.current) {
      setSelectedId(null);
      setShowAll(false);
    }
    hadQuery.current = has;
  }, [query]);

  const countByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  const selected = categories.find((c) => c.id === selectedId) ?? null;

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const filtered = products.filter(
      (p) => (!selected || p.category_id === selected.id) && (!q || normalize(p.name).includes(q)),
    );
    const discount = (p: ProductWithFlavors) =>
      p.compare_at_price_cents && p.compare_at_price_cents > p.price_cents
        ? 1 - p.price_cents / p.compare_at_price_cents
        : 0;
    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort((a, b) => a.price_cents - b.price_cents);
    if (sort === "price-desc") sorted.sort((a, b) => b.price_cents - a.price_cents);
    if (sort === "discount") sorted.sort((a, b) => discount(b) - discount(a));
    // Esgotados sempre por último, sem mudar a ordem entre os disponíveis.
    return sorted.sort((a, b) => Number(inStock(b)) - Number(inStock(a)));
  }, [products, selected, query, sort]);

  const hasFilters = Boolean(selected || query);

  // Com muitos produtos, a vitrine sem filtro vira fileiras em carrossel
  // (Novidades + uma por categoria) em vez de uma grade enorme.
  const useCarousels = !hasFilters && !showAll && products.length > CAROUSEL_THRESHOLD;
  const categoryIds = new Set(categories.map((c) => c.id));
  const uncategorized = visible.filter((p) => !p.category_id || !categoryIds.has(p.category_id));

  function clearFilters() {
    setSelectedId(null);
    setQuery("");
    setShowAll(false);
  }

  function selectCategory(id: string | null) {
    setSelectedId(id);
    setShowAll(false);
    document.getElementById("produtos")?.scrollIntoView({ behavior: "smooth" });
  }

  const chipClass = (active: boolean) =>
    `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
      active
        ? "border-transparent bg-brand text-white shadow-brand"
        : "border-blue-100 bg-white text-slate-700 hover:border-brand hover:text-brand"
    }`;

  const countClass = (active: boolean) =>
    `rounded-full px-1.5 text-xs ${active ? "bg-white/25 text-white" : "bg-blue-50 text-brand"}`;

  return (
    <section id="produtos" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-10">
      <div
        className="mb-8 rounded-3xl border border-blue-100 p-5 sm:p-6"
        style={{ background: "linear-gradient(135deg, #eff5ff 0%, #ffffff 70%)" }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand">Nossa loja</p>
            <h2 className="font-display text-2xl text-slate-900 sm:text-3xl">
              {query.trim()
                ? `Resultados para “${query.trim()}”`
                : selected
                  ? selected.name
                  : "Todos os produtos"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {visible.length} {visible.length === 1 ? "produto encontrado" : "produtos encontrados"}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-72">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                className="input pl-10 pr-9"
                placeholder="O que você está procurando?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="relative">
              <SlidersHorizontal
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <select
                className="input appearance-none pl-10 pr-9 sm:w-52"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Ordenar produtos"
              >
                <option value="recent">Mais recentes</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="discount">Maiores descontos</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
            </div>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              className={chipClass(!selected)}
              onClick={() => {
                setSelectedId(null);
                setShowAll(false);
              }}
            >
              Todos <span className={countClass(!selected)}>{products.length}</span>
            </button>
            {categories.map((cat) => {
              const active = selected?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={chipClass(active)}
                  onClick={() => setSelectedId(cat.id)}
                >
                  {cat.name} <span className={countClass(active)}>{countByCategory.get(cat.id) ?? 0}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card flex flex-col items-center p-10 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-brand">
            <Search size={24} />
          </div>
          <p className="text-slate-700">
            {products.length === 0
              ? "Nenhum produto cadastrado ainda."
              : "Nenhum produto encontrado com esses filtros."}
          </p>
          {hasFilters && (
            <button type="button" className="btn-secondary mt-4" onClick={clearFilters}>
              Limpar filtros
            </button>
          )}
        </div>
      ) : useCarousels ? (
        <div>
          <ProductCarousel
            title="Novidades"
            products={visible.slice(0, 12)}
            onSeeAll={() => {
              setShowAll(true);
              document.getElementById("produtos")?.scrollIntoView({ behavior: "smooth" });
            }}
          />
          {categories.map((cat) => {
            const rowProducts = visible.filter((p) => p.category_id === cat.id);
            return rowProducts.length > 0 ? (
              <ProductCarousel
                key={cat.id}
                title={cat.name}
                products={rowProducts}
                onSeeAll={() => selectCategory(cat.id)}
              />
            ) : null;
          })}
          {uncategorized.length > 0 && <ProductCarousel title="Outros" products={uncategorized} />}
        </div>
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
