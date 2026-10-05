"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCartStore, type CatalogLine } from "@/store/cart";

/**
 * O carrinho fica salvo no navegador, então pode ter produto que a loja já
 * excluiu, ocultou ou que esgotou. Confere com o catálogo ao abrir o site e
 * sempre que o cliente entra no carrinho ou no checkout.
 */
export function CartCatalogSync() {
  const hydrated = useCartStore((s) => s.hydrated);
  const pathname = usePathname();
  const lastRun = useRef(0);

  useEffect(() => {
    if (!hydrated) return;
    const onCartPages = pathname === "/carrinho" || pathname === "/checkout";
    // Fora do carrinho/checkout, no máximo uma conferência a cada 5 min.
    if (!onCartPages && Date.now() - lastRun.current < 5 * 60 * 1000) return;
    const items = useCartStore.getState().items;
    if (items.length === 0) return;
    lastRun.current = Date.now();
    fetch("/api/carrinho/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map((i) => ({ productId: i.productId, flavorId: i.flavorId ?? null })) }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { lines?: CatalogLine[] } | null) => {
        if (data?.lines) useCartStore.getState().syncWithCatalog(data.lines);
      })
      .catch(() => {});
  }, [hydrated, pathname]);

  return null;
}
