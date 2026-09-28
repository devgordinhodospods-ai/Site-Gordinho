"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCartStore } from "@/store/cart";
import { centsToBRL } from "@/lib/money";

export default function CarrinhoPage() {
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = useCartStore((s) => s.subtotalCents());

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Seu carrinho está vazio</h1>
        <Link href="/produtos" className="btn-primary mt-4 inline-flex">
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Seu carrinho</h1>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.productId} className="card flex items-center gap-4 p-3">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-slate-100">
              {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" />}
            </div>
            <div className="flex-1">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-slate-500">{centsToBRL(item.priceCents)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary h-8 w-8 p-0"
                onClick={() => setQuantity(item.productId, item.quantity - 1)}
              >
                -
              </button>
              <span className="w-6 text-center">{item.quantity}</span>
              <button
                className="btn-secondary h-8 w-8 p-0"
                onClick={() => setQuantity(item.productId, item.quantity + 1)}
              >
                +
              </button>
            </div>
            <button
              className="text-sm text-red-600 hover:underline"
              onClick={() => removeItem(item.productId)}
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-4">
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Subtotal</span>
          <span>{centsToBRL(subtotal)}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">Frete e taxa de serviço calculados no checkout.</p>
        <Link href="/checkout" className="btn-primary mt-4 flex w-full">
          Ir para o checkout
        </Link>
      </div>
    </div>
  );
}
