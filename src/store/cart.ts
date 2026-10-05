"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

export const GUEST_CART_KEY = "cart-storage-guest";

function sameLine(a: CartItem, b: { productId: string; flavorId?: string | null }) {
  return a.productId === b.productId && (a.flavorId ?? null) === (b.flavorId ?? null);
}

/** Resultado da conferência do carrinho com o catálogo (api/carrinho/validar). */
export type CatalogLine = {
  productId: string;
  flavorId: string | null;
  status: "ok" | "removed";
  reason?: "indisponivel" | "esgotado";
  name?: string;
  slug?: string;
  priceCents?: number;
  stock?: number;
  flavorName?: string | null;
  image?: string | null;
};

type CartState = {
  items: CartItem[];
  /** Itens tirados do carrinho na última conferência (pra avisar o cliente). */
  removedNotice: string[];
  /** true depois que o carrinho da conta atual foi carregado do navegador. */
  hydrated: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, flavorId?: string | null) => void;
  setQuantity: (productId: string, quantity: number, flavorId?: string | null) => void;
  clear: () => void;
  syncWithCatalog: (lines: CatalogLine[]) => void;
  dismissRemovedNotice: () => void;
  subtotalCents: () => number;
  totalQuantity: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      removedNotice: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => sameLine(i, item));
          if (existing) {
            const newQty = Math.min(existing.quantity + item.quantity, item.stock);
            return {
              items: state.items.map((i) =>
                sameLine(i, item) ? { ...i, quantity: newQty, stock: item.stock } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: Math.min(item.quantity, item.stock) }] };
        }),
      removeItem: (productId, flavorId = null) =>
        set((state) => ({
          items: state.items.filter((i) => !sameLine(i, { productId, flavorId })),
        })),
      setQuantity: (productId, quantity, flavorId = null) =>
        set((state) => ({
          items: state.items.map((i) =>
            sameLine(i, { productId, flavorId })
              ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) }
              : i
          ),
        })),
      clear: () => set({ items: [] }),
      syncWithCatalog: (lines) =>
        set((state) => {
          const removed: string[] = [];
          const items = state.items.flatMap((item) => {
            const line = lines.find((l) => sameLine(item, l));
            if (!line) return [item];
            const label = item.flavorName ? `${item.name} (${item.flavorName})` : item.name;
            if (line.status === "removed") {
              removed.push(line.reason === "esgotado" ? `${label} — esgotou` : `${label} — não está mais à venda`);
              return [];
            }
            const stock = line.stock ?? item.stock;
            return [
              {
                ...item,
                name: line.name ?? item.name,
                slug: line.slug ?? item.slug,
                priceCents: line.priceCents ?? item.priceCents,
                stock,
                flavorName: line.flavorName ?? item.flavorName,
                image: line.image ?? item.image,
                quantity: Math.max(1, Math.min(item.quantity, stock)),
              },
            ];
          });
          return { items, removedNotice: removed.length > 0 ? removed : state.removedNotice };
        }),
      dismissRemovedNotice: () => set({ removedNotice: [] }),
      subtotalCents: () => get().items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
      totalQuantity: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: GUEST_CART_KEY,
      // A chave de armazenamento é trocada por conta logada (ver
      // CartAccountSync); skipHydration evita carregar o carrinho errado
      // antes de saber quem está logado.
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
      // Ao trocar de conta, o carrinho carregado SUBSTITUI o que está em
      // memória (o padrão do zustand manteria os itens da conta anterior
      // quando a nova conta ainda não tem carrinho salvo).
      merge: (persisted, current) => ({
        ...current,
        items: (persisted as { items?: CartItem[] } | undefined)?.items ?? [],
      }),
    }
  )
);

/** Lê os itens salvos de um carrinho no localStorage sem carregá-lo na loja. */
export function readStoredCart(key: string): CartItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.state?.items) ? parsed.state.items : [];
  } catch {
    return [];
  }
}
