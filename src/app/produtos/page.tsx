"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/loja/ProductCard";
import { LoaderPage } from "@/components/ui/Loader";
import type { Product } from "@/lib/types";

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("busca", search);

    fetch(`/api/produtos?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setProducts(data.products ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl text-slate-900">Produtos</h1>
        <input
          className="input max-w-xs"
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <LoaderPage label="Carregando produtos..." />
      ) : products.length === 0 ? (
        <p className="text-slate-500">Nenhum produto encontrado.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
