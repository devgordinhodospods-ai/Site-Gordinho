"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { centsToBRL } from "@/lib/money";
import type { Order, OrderItem } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pagamento aprovado",
  confirmed: "Confirmado",
  preparing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

function PedidoDetalheContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("status");
  const [order, setOrder] = useState<(Order & { order_items: OrderItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pedidos/${params.id}`)
      .then((res) => res.json())
      .then((data) => setOrder(data.order ?? null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-8">Carregando...</div>;
  if (!order) return <div className="mx-auto max-w-2xl px-4 py-8">Pedido não encontrado.</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {paymentStatus === "success" && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
          Pagamento em processamento! Você receberá um e-mail assim que for confirmado.
        </div>
      )}
      {paymentStatus === "pending" && (
        <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Seu pagamento está pendente de confirmação.
        </div>
      )}
      {paymentStatus === "failure" && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          O pagamento não foi concluído. Tente novamente.
        </div>
      )}

      <h1 className="text-2xl font-bold">Pedido #{order.id.slice(0, 8)}</h1>
      <p className="mt-1 text-neutral-500">Status: {STATUS_LABELS[order.status] ?? order.status}</p>

      <div className="card mt-6 divide-y">
        {order.order_items.map((item) => (
          <div key={item.id} className="flex justify-between p-3">
            <span>
              {item.quantity}x {item.product_name}
            </span>
            <span>{centsToBRL(item.unit_price_cents * item.quantity)}</span>
          </div>
        ))}
      </div>

      <div className="card mt-4 space-y-1 p-4 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{centsToBRL(order.subtotal_cents)}</span>
        </div>
        <div className="flex justify-between">
          <span>Frete</span>
          <span>{centsToBRL(order.shipping_fee_cents)}</span>
        </div>
        <div className="flex justify-between">
          <span>Taxa de serviço</span>
          <span>{centsToBRL(order.service_fee_cents)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span>
          <span>{centsToBRL(order.total_cents)}</span>
        </div>
      </div>
    </div>
  );
}

export default function PedidoDetalhePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-8">Carregando...</div>}>
      <PedidoDetalheContent />
    </Suspense>
  );
}
