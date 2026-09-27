"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { centsToBRL } from "@/lib/money";
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
      <h1 className="mb-6 text-2xl font-bold">Meus pedidos</h1>

      {loading ? (
        <p className="text-neutral-500">Carregando...</p>
      ) : orders.length === 0 ? (
        <p className="text-neutral-500">Você ainda não fez nenhum pedido.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/pedidos/${order.id}`}
              className="card flex items-center justify-between p-4"
            >
              <div>
                <p className="font-medium">Pedido #{order.id.slice(0, 8)}</p>
                <p className="text-sm text-neutral-500">
                  {new Date(order.created_at).toLocaleDateString("pt-BR")} · {STATUS_LABELS[order.status]}
                </p>
              </div>
              <span className="font-bold">{centsToBRL(order.total_cents)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
