"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import type { Product, ProductFlavor } from "@/lib/types";

export function AddToCartButton({
  product,
  flavors = [],
}: {
  product: Product;
  flavors?: ProductFlavor[];
}) {
  const hasFlavors = flavors.length > 0;
  const [selectedFlavorId, setSelectedFlavorId] = useState<string | null>(
    hasFlavors ? flavors.find((f) => f.stock > 0)?.id ?? flavors[0].id : null
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();

  const selectedFlavor = hasFlavors ? flavors.find((f) => f.id === selectedFlavorId) : null;
  const availableStock = hasFlavors ? selectedFlavor?.stock ?? 0 : product.stock;
  const outOfStock = availableStock <= 0;

  function handleAdd() {
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      priceCents: product.price_cents,
      image: (selectedFlavor?.image_url ?? product.images?.[0]) ?? null,
      quantity,
      stock: availableStock,
      flavorId: selectedFlavor?.id ?? null,
      flavorName: selectedFlavor?.name ?? null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="flex flex-col gap-3">
      {hasFlavors && (
        <div>
          <p className="mb-2 text-sm font-bold text-slate-700">Escolha o sabor:</p>
          <div className="flex flex-wrap gap-2">
            {flavors.map((flavor) => {
              const flavorOut = flavor.stock <= 0;
              const selected = flavor.id === selectedFlavorId;
              return (
                <button
                  key={flavor.id}
                  type="button"
                  disabled={flavorOut}
                  onClick={() => {
                    setSelectedFlavorId(flavor.id);
                    setQuantity(1);
                  }}
                  className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${
                    flavorOut
                      ? "cursor-not-allowed border-slate-100 text-slate-300 line-through"
                      : selected
                        ? "border-brand bg-blue-50 text-brand"
                        : "border-slate-200 text-slate-600 hover:border-brand"
                  }`}
                >
                  {flavor.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {outOfStock ? "Sabor esgotado" : `${availableStock} em estoque`}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <QuantityStepper
          value={quantity}
          min={1}
          max={Math.max(1, availableStock)}
          disabled={outOfStock}
          onChange={setQuantity}
        />
        <button className="btn-primary flex-1" onClick={handleAdd} disabled={outOfStock}>
          {outOfStock ? (
            "Esgotado"
          ) : added ? (
            <>
              <Check size={16} /> Adicionado!
            </>
          ) : (
            <>
              <ShoppingCart size={16} /> Adicionar ao carrinho
            </>
          )}
        </button>
      </div>

      {!outOfStock && (
        <button
          className="btn-secondary"
          onClick={() => {
            handleAdd();
            router.push("/carrinho");
          }}
        >
          Comprar agora
        </button>
      )}
    </div>
  );
}
