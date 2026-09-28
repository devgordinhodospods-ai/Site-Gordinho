"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart";
import { centsToBRL } from "@/lib/money";

type Zone = { id: string; name: string };
type ShippingBreakdown = {
  totalCents: number;
  peakHour: boolean;
  raining: boolean;
  lateNight: boolean;
  appliedMultiplier: number;
};

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotalCents());
  const clearCart = useCartStore((s) => s.clear);

  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [shipping, setShipping] = useState<ShippingBreakdown | null>(null);
  const [serviceFee, setServiceFee] = useState({ percent: 0, fixed: 0 });
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [address, setAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip: "",
  });
  const [phone, setPhone] = useState("");

  useEffect(() => {
    fetch("/api/shipping/zones")
      .then((res) => res.json())
      .then((data) => setZones(data.zones ?? []));
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((data) =>
        setServiceFee({ percent: data.serviceFeePercent ?? 0, fixed: data.serviceFeeFixed ?? 0 })
      );
  }, []);

  useEffect(() => {
    if (!zoneId) {
      setShipping(null);
      return;
    }
    setLoadingShipping(true);
    fetch("/api/shipping/calc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zoneId }),
    })
      .then((res) => res.json())
      .then((data) => setShipping(data.breakdown ?? null))
      .finally(() => setLoadingShipping(false));
  }, [zoneId]);

  const serviceFeeCents = Math.round((subtotal * serviceFee.percent) / 100) + serviceFee.fixed;
  const shippingFeeCents = shipping?.totalCents ?? 0;
  const total = subtotal + shippingFeeCents + serviceFeeCents;

  if (status === "loading") return null;

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Faça login para continuar</h1>
        <p className="mt-2 text-neutral-500">Você precisa ter uma conta para finalizar o pedido.</p>
        <Link href="/login?callbackUrl=/checkout" className="btn-primary mt-4 inline-flex">
          Entrar
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Seu carrinho está vazio</h1>
        <Link href="/produtos" className="btn-primary mt-4 inline-flex">
          Ver produtos
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!zoneId) {
      setError("Selecione a região de entrega.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          zoneId,
          address,
          customerPhone: phone,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Não foi possível finalizar o pedido.");
        setSubmitting(false);
        return;
      }

      clearCart();

      if (data.initPoint) {
        window.location.href = data.initPoint;
      } else {
        router.push(`/pedidos/${data.orderId}`);
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Finalizar pedido</h1>

      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-semibold">Endereço de entrega</h2>
          <input
            className="input"
            placeholder="Rua"
            required
            value={address.street}
            onChange={(e) => setAddress({ ...address, street: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Número"
              required
              value={address.number}
              onChange={(e) => setAddress({ ...address, number: e.target.value })}
            />
            <input
              className="input"
              placeholder="Complemento"
              value={address.complement}
              onChange={(e) => setAddress({ ...address, complement: e.target.value })}
            />
          </div>
          <input
            className="input"
            placeholder="Bairro"
            required
            value={address.neighborhood}
            onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Cidade"
              required
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
            />
            <input
              className="input w-24"
              placeholder="UF"
              required
              maxLength={2}
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })}
            />
          </div>
          <input
            className="input"
            placeholder="CEP"
            required
            value={address.zip}
            onChange={(e) => setAddress({ ...address, zip: e.target.value })}
          />
          <input
            className="input"
            placeholder="Telefone / WhatsApp"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div>
            <label className="mb-1 block text-sm font-medium">Região de entrega</label>
            <select className="input" required value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">Selecione...</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">Resumo do pedido</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{centsToBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Frete</span>
                <span>{loadingShipping ? "calculando..." : zoneId ? centsToBRL(shippingFeeCents) : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxa de serviço</span>
                <span>{centsToBRL(serviceFeeCents)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
                <span>Total</span>
                <span>{centsToBRL(total)}</span>
              </div>
            </div>

            {shipping && (shipping.peakHour || shipping.raining || shipping.lateNight) && (
              <div className="mt-3 space-y-1 text-xs text-amber-700">
                {shipping.raining && <p>⛆ Frete com acréscimo por chuva na região da loja.</p>}
                {shipping.peakHour && <p>⏰ Frete com acréscimo por horário de pico.</p>}
                {shipping.lateNight && <p>🌙 Frete com acréscimo de madrugada.</p>}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button type="submit" className="btn-primary mt-4 w-full" disabled={submitting}>
              {submitting ? "Processando..." : "Pagar com Mercado Pago"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
