"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Lock, ShoppingBag, Trash2 } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { centsToBRL } from "@/lib/money";
import { LoaderPage } from "@/components/ui/Loader";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { FreightEstimator } from "@/components/loja/FreightEstimator";
import { CartRemovedNotice } from "@/components/loja/CartRemovedNotice";

export default function CarrinhoPage() {
  const { status: sessionStatus } = useSession();
  const loggedIn = sessionStatus === "authenticated";
  const hydrated = useCartStore((s) => s.hydrated);
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = useCartStore((s) => s.subtotalCents());
  const totalQuantity = useCartStore((s) => s.totalQuantity());

  if (!hydrated) return <LoaderPage label="Carregando carrinho..." />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <CartRemovedNotice className="mb-8" />
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-brand">
          <ShoppingBag size={28} />
        </div>
        <h1 className="font-display text-xl text-slate-900">Seu carrinho está vazio</h1>
        <p className="mt-1 text-sm text-slate-500">Que tal dar uma olhada no catálogo?</p>
        <Link href="/#produtos" className="btn-primary mt-6">
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display mb-6 text-2xl text-slate-900">
        Seu carrinho <span className="text-base text-slate-400">({totalQuantity} {totalQuantity === 1 ? "item" : "itens"})</span>
      </h1>
      <CartRemovedNotice className="mb-6" />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="card divide-y divide-blue-50">
          {items.map((item) => (
            <div key={`${item.productId}-${item.flavorId ?? ""}`} className="flex gap-3 p-4 sm:gap-4">
              <Link
                href={`/produto/${item.slug}`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100"
              >
                {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" sizes="80px" />}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/produto/${item.slug}`} className="line-clamp-2 text-slate-900 hover:text-brand">
                      {item.name}
                    </Link>
                    {item.flavorName && <p className="text-xs text-slate-500">Sabor: {item.flavorName}</p>}
                    <p className="text-sm text-slate-500">{centsToBRL(item.priceCents)} cada</p>
                  </div>
                  <button
                    className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeItem(item.productId, item.flavorId)}
                    aria-label="Remover do carrinho"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-auto flex items-center justify-between pt-2">
                  <QuantityStepper
                    size="sm"
                    value={item.quantity}
                    max={item.stock}
                    onChange={(q) => setQuantity(item.productId, q, item.flavorId)}
                  />
                  <span className="text-brand">{centsToBRL(item.priceCents * item.quantity)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card p-5 lg:sticky lg:top-24">
          <h2 className="font-display mb-4 text-lg text-slate-900">Resumo</h2>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span className="text-lg text-slate-900">{centsToBRL(subtotal)}</span>
          </div>
          <div className="mt-4 border-t border-blue-50 pt-4">
            <FreightEstimator label="Calcule o frete (motoboy):" />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            A taxa de serviço é calculada no checkout. O frete é uma estimativa e é pago direto ao entregador na hora
            da entrega, não no site.
          </p>
          <Link href={loggedIn ? "/checkout" : "/login?callbackUrl=/checkout"} className="btn-primary mt-5 w-full">
            Finalizar compra
          </Link>
          {!loggedIn && (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-500">
              <Lock size={12} /> Você vai entrar ou criar sua conta pra finalizar.
            </p>
          )}
          <Link href="/#produtos" className="mt-3 block text-center text-sm text-brand hover:underline">
            Continuar comprando
          </Link>
        </div>
      </div>
    </div>
  );
}
