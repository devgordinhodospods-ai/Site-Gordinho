"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { ProductCard } from "@/components/loja/ProductCard";
import { LoaderPage } from "@/components/ui/Loader";
import type { Product } from "@/lib/types";

function ProdutosContent() {
  const searchParams = useSearchParams();
  const categoria = searchParams.get("categoria");
  const buscaFromUrl = searchParams.get("busca") ?? "";

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState(buscaFromUrl);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("busca", search);
    if (categoria) params.set("categoria", categoria);

    fetch(`/api/produtos?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setProducts(data.products ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [search, categoria]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl text-slate-900">Produtos</h1>
        <input
          className="input max-w-xs"
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {categoria && (
        <Link
          href="/produtos"
          className="mb-6 inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-brand"
        >
          Categoria: {categoria} <X size={14} />
        </Link>
      )}

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

export default function ProdutosPage() {
  return (
    <Suspense fallback={<LoaderPage />}>
      <ProdutosContent />
    </Suspense>
  );
}
