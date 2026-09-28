"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, MapPin, XCircle } from "lucide-react";
import { centsToBRL } from "@/lib/money";
import { LoaderPage } from "@/components/ui/Loader";
import type { Order, OrderItem, OrderStatus } from "@/lib/types";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "awaiting_payment", label: "Pedido feito" },
  { status: "paid", label: "Pago" },
  { status: "preparing", label: "Em preparação" },
  { status: "shipped", label: "Saiu pra entrega" },
  { status: "delivered", label: "Entregue" },
];

// "confirmado" fica entre pago e em preparação na linha do tempo.
const STEP_INDEX: Record<OrderStatus, number> = {
  awaiting_payment: 0,
  paid: 1,
  confirmed: 1,
  preparing: 2,
  shipped: 3,
  delivered: 4,
  cancelled: -1,
};

function formatAddress(address: Record<string, unknown>) {
  const a = address as Record<string, string | undefined>;
  if (!a.street) return null;
  return [
    `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""}`,
    a.neighborhood,
    `${a.city}/${a.state}`,
    a.zip,
  ]
    .filter(Boolean)
    .join(" · ");
}

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
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <LoaderPage label="Carregando pedido..." />;
  if (!order) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-xl text-slate-900">Pedido não encontrado</h1>
        <Link href="/pedidos" className="btn-secondary mt-6">
          Ver meus pedidos
        </Link>
      </div>
    );
  }

  const cancelled = order.status === "cancelled";
  const currentStep = STEP_INDEX[order.status];
  const address = formatAddress(order.shipping_address);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/pedidos" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand">
        <ArrowLeft size={14} /> Meus pedidos
      </Link>

      {paymentStatus === "success" && order.status === "awaiting_payment" && (
        <div className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">
          Pagamento recebido pelo Mercado Pago! Assim que ele for confirmado, o status do pedido muda aqui e você
          recebe um e-mail.
        </div>
      )}
      {paymentStatus === "pending" && order.status === "awaiting_payment" && (
        <div className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Seu pagamento está pendente de confirmação. Se pagou via Pix, isso costuma levar poucos minutos.
        </div>
      )}
      {paymentStatus === "failure" && (
        <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          O pagamento não foi concluído. Você pode montar o carrinho de novo e tentar outra vez.
        </div>
      )}

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-2xl text-slate-900">Pedido #{order.id.slice(0, 8).toUpperCase()}</h1>
          <span className="text-sm text-slate-500">{new Date(order.created_at).toLocaleString("pt-BR")}</span>
        </div>

        {cancelled ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <XCircle size={18} /> Pedido cancelado
          </p>
        ) : (
          <ol className="mt-6 grid grid-cols-5 gap-1">
            {STEPS.map((step, i) => {
              const done = i <= currentStep;
              return (
                <li key={step.status} className="flex flex-col items-center text-center">
                  <span
                    className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full ${
                      done ? "bg-brand text-white" : "bg-slate-100 text-slate-300"
                    }`}
                  >
                    {done ? <CheckCircle2 size={18} /> : <Clock size={16} />}
                  </span>
                  <span className={`text-[11px] leading-tight sm:text-xs ${done ? "text-slate-800" : "text-slate-400"}`}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="card mt-4 divide-y divide-blue-50">
        {order.order_items.map((item) => (
          <div key={item.id} className="flex justify-between gap-3 p-4 text-sm">
            <span className="text-slate-800">
              {item.quantity}x {item.product_name}
              {item.flavor_name && <span className="block text-xs text-slate-500">Sabor: {item.flavor_name}</span>}
            </span>
            <span className="text-slate-700">{centsToBRL(item.unit_price_cents * item.quantity)}</span>
          </div>
        ))}
        <div className="space-y-1 p-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{centsToBRL(order.subtotal_cents)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Taxa de serviço</span>
            <span>{centsToBRL(order.service_fee_cents)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base text-slate-900">
            <span>Total pago no site</span>
            <span className="text-brand">{centsToBRL(order.total_cents)}</span>
          </div>
        </div>
      </div>

      <div className="card mt-4 space-y-3 p-4 text-sm">
        {address && (
          <p className="flex gap-2 text-slate-700">
            <MapPin size={16} className="mt-0.5 shrink-0 text-brand" />
            {address}
          </p>
        )}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
          {order.shipping_fee_cents > 0 && (
            <div className="flex justify-between">
              <span>Frete estimado</span>
              <span>{centsToBRL(order.shipping_fee_cents)}</span>
            </div>
          )}
          <p className="text-xs">O frete é pago em dinheiro ou Pix direto ao entregador na hora da entrega.</p>
        </div>
      </div>
    </div>
  );
}

export default function PedidoDetalhePage() {
  return (
    <Suspense fallback={<LoaderPage />}>
      <PedidoDetalheContent />
    </Suspense>
  );
}
