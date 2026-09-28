"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { centsToBRL } from "@/lib/money";
import { LoaderPage } from "@/components/ui/Loader";
import type { Order } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pagamento aprovado",
  confirmed: "Confirmado",
  preparing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_PILL: Record<string, string> = {
  awaiting_payment: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function PedidosPage() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/pedidos")
      .then((res) => res.json())
      .then((data) => setOrders(data.orders ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading") return null;

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Faça login para ver seus pedidos</h1>
        <Link href="/login?callbackUrl=/pedidos" className="btn-primary mt-4 inline-flex">
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display mb-6 text-2xl text-slate-900">Meus pedidos</h1>

      {loading ? (
        <LoaderPage label="Carregando pedidos..." />
      ) : orders.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-600">Você ainda não fez nenhum pedido.</p>
          <Link href="/produtos" className="btn-primary mt-4">
            Ver produtos
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/pedidos/${order.id}`}
              className="card flex items-center justify-between gap-3 p-4 transition-transform hover:-translate-y-0.5"
            >
              <div className="min-w-0">
                <p className="text-slate-900">Pedido #{order.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-sm text-slate-500">{new Date(order.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-brand">{centsToBRL(order.total_cents)}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS_PILL[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
