"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();

  const outOfStock = product.stock <= 0;

  function handleAdd() {
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      priceCents: product.price_cents,
      image: product.images?.[0] ?? null,
      quantity,
      stock: product.stock,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          className="btn-secondary h-9 w-9 p-0"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={outOfStock}
        >
          -
        </button>
        <span className="w-8 text-center">{quantity}</span>
        <button
          className="btn-secondary h-9 w-9 p-0"
          onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
          disabled={outOfStock}
        >
          +
        </button>
      </div>

      <button className="btn-primary" onClick={handleAdd} disabled={outOfStock}>
        {outOfStock ? "Esgotado" : added ? "Adicionado!" : "Adicionar ao carrinho"}
      </button>

      {!outOfStock && (
        <button className="btn-secondary" onClick={() => { handleAdd(); router.push("/carrinho"); }}>
          Comprar agora
        </button>
      )}
    </div>
  );
}
