"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { centsToBRL } from "@/lib/money";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { FlavorSelect, type FlavorSelectHandle } from "@/components/loja/FlavorSelect";
import type { Product, ProductFlavor } from "@/lib/types";

export function AddToCartButton({
  product,
  flavors = [],
}: {
  product: Product;
  flavors?: ProductFlavor[];
}) {
  const hasFlavors = flavors.length > 0;
  // Com vários sabores o cliente escolhe (nada pré-selecionado, pra não levar
  // sabor errado sem perceber); com um só disponível, já vem escolhido.
  const inStockFlavors = flavors.filter((f) => f.stock > 0);
  const [selectedFlavorId, setSelectedFlavorId] = useState<string | null>(
    inStockFlavors.length === 1 ? inStockFlavors[0].id : null
  );
  const [flavorHint, setFlavorHint] = useState(false);
  const flavorSelectRef = useRef<FlavorSelectHandle>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();

  // No celular, quando o botão principal sai da tela (rolando pra ler a
  // descrição), aparece uma barra fixa embaixo com o preço e "Adicionar".
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  useEffect(() => {
    const actions = actionsRef.current;
    if (!actions) return;
    const observer = new IntersectionObserver(([entry]) =>
      setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    );
    observer.observe(actions);
    // Espaço no fim da página pra barra não cobrir o rodapé (só no celular, via CSS).
    document.body.classList.add("has-sticky-buy-bar");
    return () => {
      observer.disconnect();
      document.body.classList.remove("has-sticky-buy-bar");
    };
  }, []);

  const selectedFlavor = hasFlavors ? flavors.find((f) => f.id === selectedFlavorId) : null;
  const needsFlavor = hasFlavors && !selectedFlavor;
  const availableStock = hasFlavors
    ? selectedFlavor?.stock ?? inStockFlavors.reduce((n, f) => n + f.stock, 0)
    : product.stock;
  const outOfStock = availableStock <= 0;

  /** Sem sabor escolhido: abre a lista em vez de adicionar. */
  function ensureFlavor() {
    if (!needsFlavor) return true;
    setFlavorHint(true);
    flavorSelectRef.current?.open();
    return false;
  }

  function handleAdd() {
    if (!ensureFlavor()) return;
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
          <FlavorSelect
            ref={flavorSelectRef}
            flavors={flavors}
            value={selectedFlavorId}
            highlight={flavorHint}
            onChange={(id) => {
              setSelectedFlavorId(id);
              setQuantity(1);
              setFlavorHint(false);
            }}
          />
          {flavorHint && needsFlavor && (
            <p className="mt-2 text-sm text-amber-700">Escolha o sabor pra adicionar ao carrinho.</p>
          )}
          {outOfStock && <p className="mt-2 text-sm text-slate-500">Todos os sabores esgotados</p>}
        </div>
      )}

      <div ref={actionsRef} className="flex gap-3">
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
            if (!ensureFlavor()) return;
            handleAdd();
            router.push("/carrinho");
          }}
        >
          Comprar agora
        </button>
      )}

      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-blue-100 bg-white/95 px-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.25)] backdrop-blur transition-transform duration-300 sm:hidden ${
          showStickyBar ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        aria-hidden={!showStickyBar}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-700">
              {product.name}
              {selectedFlavor ? ` · ${selectedFlavor.name}` : ""}
            </p>
            <p className="font-display text-lg leading-tight text-brand">{centsToBRL(product.price_cents)}</p>
          </div>
          <button
            className="btn-primary shrink-0 px-5"
            onClick={handleAdd}
            disabled={outOfStock}
            tabIndex={showStickyBar ? 0 : -1}
          >
            {outOfStock ? (
              "Esgotado"
            ) : added ? (
              <>
                <Check size={16} /> Adicionado!
              </>
            ) : (
              <>
                <ShoppingCart size={16} /> Adicionar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
