"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { centsToBRL } from "@/lib/money";
import { useCartStore } from "@/store/cart";
import type { ProductWithFlavors } from "@/lib/types";

export function ProductCard({ product }: { product: ProductWithFlavors }) {
  const image = product.images?.[0];
  const flavors = product.product_flavors ?? [];
  const hasFlavors = flavors.length > 0;
  const totalStock = hasFlavors ? flavors.reduce((sum, f) => sum + f.stock, 0) : product.stock;
  const outOfStock = totalStock <= 0;
  const addItem = useCartStore((s) => s.addItem);
  const [justAdded, setJustAdded] = useState(false);

  const hasDiscount =
    product.compare_at_price_cents != null && product.compare_at_price_cents > product.price_cents;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price_cents / (product.compare_at_price_cents as number)) * 100)
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
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <Link href={`/produto/${product.slug}`} className="card group relative flex flex-col overflow-hidden">
      <div className="relative aspect-square bg-slate-100">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            className={`object-cover transition group-hover:scale-105 ${outOfStock ? "opacity-60 grayscale" : ""}`}
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem imagem</div>
        )}
        {outOfStock ? (
          <span className="absolute left-2 top-2 rounded-md bg-slate-900 px-2 py-1 text-xs text-white">Esgotado</span>
        ) : hasDiscount ? (
          <span className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-1 text-xs text-white">
            -{discountPercent}%
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm text-slate-800">{product.name}</h3>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            <p className="h-4 text-xs text-slate-400 line-through">
              {hasDiscount ? centsToBRL(product.compare_at_price_cents as number) : ""}
            </p>
            <p className="text-lg leading-tight text-brand">{centsToBRL(product.price_cents)}</p>
          </div>

          {!outOfStock &&
            (hasFlavors ? (
              <span className="shrink-0 pb-1 text-xs text-slate-400 group-hover:text-brand">Ver sabores</span>
            ) : (
              <button
                onClick={handleQuickAdd}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-brand transition-transform hover:scale-110 ${
                  justAdded ? "bg-green-600" : ""
                }`}
                style={justAdded ? undefined : { background: "linear-gradient(135deg, #2563eb, #0f2f8f)" }}
                aria-label={justAdded ? "Adicionado ao carrinho" : "Adicionar ao carrinho"}
              >
                {justAdded ? <Check size={16} /> : <Plus size={16} />}
              </button>
            ))}
        </div>
      </div>
    </Link>
  );
}
