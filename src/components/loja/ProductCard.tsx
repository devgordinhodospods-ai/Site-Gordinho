"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { centsToBRL } from "@/lib/money";
import { useCartStore } from "@/store/cart";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images?.[0];
  const outOfStock = product.stock <= 0;
  const addItem = useCartStore((s) => s.addItem);

  const hasDiscount =
    product.compare_at_price_cents != null && product.compare_at_price_cents > product.price_cents;
  const discountPercent = hasDiscount
    ? Math.round(
        (1 - product.price_cents / (product.compare_at_price_cents as number)) * 100
      )
    : 0;

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      priceCents: product.price_cents,
      image: image ?? null,
      quantity: 1,
      stock: product.stock,
    });
  }

  return (
    <Link href={`/produto/${product.slug}`} className="card group relative overflow-hidden">
      <div className="relative aspect-square bg-slate-100">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            className="object-cover transition group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">Sem imagem</div>
        )}
        {outOfStock ? (
          <span className="absolute left-2 top-2 rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">
            Esgotado
          </span>
        ) : hasDiscount ? (
          <span className="font-display absolute left-2 top-2 rounded bg-red-600 px-2 py-1 text-xs text-white">
            -{discountPercent}%
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-slate-800">{product.name}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          {hasDiscount && (
            <span className="text-xs text-slate-400 line-through">
              {centsToBRL(product.compare_at_price_cents as number)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="font-display text-lg text-brand">{centsToBRL(product.price_cents)}</span>
          {!outOfStock && (
            <button
              onClick={handleQuickAdd}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-brand transition-transform hover:scale-110"
              style={{ background: "linear-gradient(135deg, #2563eb, #0f2f8f)" }}
              aria-label="Adicionar ao carrinho"
              title="Adicionar ao carrinho"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
