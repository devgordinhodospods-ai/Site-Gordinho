"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCartStore } from "@/store/cart";

/**
 * Troca a chave de armazenamento do carrinho conforme a conta logada, pra
 * cada cliente ter o próprio carrinho no mesmo navegador (sem isso, o
 * carrinho ficava "vazando" de uma conta pra outra via localStorage).
 */
export function CartAccountSync() {
  const { data: session, status } = useSession();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    const key = session?.user?.id ? `cart-storage-${session.user.id}` : "cart-storage-guest";
    if (lastKey.current === key) return;
    lastKey.current = key;

    useCartStore.persist.setOptions({ name: key });
    useCartStore.persist.rehydrate();
  }, [session?.user?.id, status]);

  return null;
}
