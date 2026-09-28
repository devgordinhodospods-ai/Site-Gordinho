"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { GUEST_CART_KEY, readStoredCart, useCartStore } from "@/store/cart";

/**
 * Cada conta tem o próprio carrinho no navegador. Quando um visitante monta
 * o carrinho e faz login (caminho normal: carrinho → checkout → login), os
 * itens do visitante são somados ao carrinho da conta em vez de sumirem.
 */
export function CartAccountSync() {
  const { data: session, status } = useSession();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    const userId = session?.user?.id;
    const key = userId ? `cart-storage-${userId}` : GUEST_CART_KEY;
    if (lastKey.current === key) return;
    lastKey.current = key;

    const guestItems = userId ? readStoredCart(GUEST_CART_KEY) : [];

    useCartStore.persist.setOptions({ name: key });
    Promise.resolve(useCartStore.persist.rehydrate()).then(() => {
      if (guestItems.length > 0) {
        const { addItem } = useCartStore.getState();
        guestItems.forEach((item) => addItem(item));
        localStorage.removeItem(GUEST_CART_KEY);
      }
      useCartStore.setState({ hydrated: true });
    });
  }, [session?.user?.id, status]);

  return null;
}
