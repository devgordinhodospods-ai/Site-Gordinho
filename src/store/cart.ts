"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

function sameLine(a: CartItem, b: { productId: string; flavorId?: string | null }) {
  return a.productId === b.productId && (a.flavorId ?? null) === (b.flavorId ?? null);
}

type CartState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, flavorId?: string | null) => void;
  setQuantity: (productId: string, quantity: number, flavorId?: string | null) => void;
  clear: () => void;
  subtotalCents: () => number;
  totalQuantity: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => sameLine(i, item));
          if (existing) {
            const newQty = Math.min(existing.quantity + item.quantity, item.stock);
            return {
              items: state.items.map((i) => (sameLine(i, item) ? { ...i, quantity: newQty } : i)),
            };
          }
          return { items: [...state.items, item] };
        }),
      removeItem: (productId, flavorId = null) =>
        set((state) => ({
          items: state.items.filter((i) => !sameLine(i, { productId, flavorId })),
        })),
      setQuantity: (productId, quantity, flavorId = null) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              sameLine(i, { productId, flavorId })
                ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),
      clear: () => set({ items: [] }),
      subtotalCents: () =>
        get().items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
      totalQuantity: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "cart-storage-guest",
      // A chave de armazenamento é trocada em tempo real por conta logada
      // (ver CartAccountSync) — sem isso, o carrinho de um cliente aparecia
      // pro próximo que logasse no mesmo navegador. skipHydration evita
      // carregar o carrinho errado antes de saber quem está logado.
      skipHydration: true,
    }
  )
);
