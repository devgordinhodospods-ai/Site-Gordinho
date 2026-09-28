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
        <p className="text-slate-500">Você ainda não fez nenhum pedido.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/pedidos/${order.id}`}
              className="card flex items-center justify-between p-4 transition-transform hover:-translate-y-0.5"
            >
              <div>
                <p className="font-bold text-slate-900">Pedido #{order.id.slice(0, 8)}</p>
                <p className="text-sm text-slate-500">
                  {new Date(order.created_at).toLocaleDateString("pt-BR")} · {STATUS_LABELS[order.status]}
                </p>
              </div>
              <span className="font-display text-brand">{centsToBRL(order.total_cents)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
