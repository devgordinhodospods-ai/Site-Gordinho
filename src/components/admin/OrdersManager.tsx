"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { centsToBRL } from "@/lib/money";
import type { Order, OrderItem, OrderStatus } from "@/lib/types";

const STATUS_FLOW: OrderStatus[] = [
  "awaiting_payment",
  "paid",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  confirmed: "Confirmado",
  preparing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

type OrderWithItems = Order & { order_items: OrderItem[] };

export function OrdersManager() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { orders } = await adminApi<{ orders: OrderWithItems[] }>("listOrders", {
      status: filter || undefined,
    });
    setOrders(orders);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function updateStatus(id: string, status: OrderStatus) {
    await adminApi("updateOrderStatus", { id, status });
    await load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <select className="input w-56" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_FLOW.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : orders.length === 0 ? (
        <p className="text-slate-500">Nenhum pedido encontrado.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    #{order.id.slice(0, 8)} · {order.customer_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {order.customer_email} · {new Date(order.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <span className="font-bold">{centsToBRL(order.total_cents)}</span>
              </div>

              <ul className="mt-2 text-sm text-slate-600">
                {order.order_items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}x {item.product_name}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <select
                  className="input w-56"
                  value={order.status}
                  onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                >
                  {STATUS_FLOW.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
