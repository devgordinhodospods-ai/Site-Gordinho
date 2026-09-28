"use client";

import { useEffect, useState } from "react";
import { MessageCircle, MapPin, CreditCard } from "lucide-react";
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

const STATUS_PILL: Record<OrderStatus, string> = {
  awaiting_payment: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

type OrderWithItems = Order & { order_items: OrderItem[] };

function formatAddress(address: Record<string, unknown>): string {
  const { street, number, complement, neighborhood, city, state, zip } = address as Record<string, string>;
  if (!street) return "—";
  const parts = [
    `${street}, ${number}`,
    complement,
    neighborhood,
    city && state ? `${city} - ${state}` : city || state,
    zip,
  ].filter(Boolean);
  return parts.join(" - ");
}

function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/55${digits}`;
}

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-slate-900">Pedidos Realizados</h1>
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
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-display text-brand">Pedido #{order.id.slice(0, 8).toUpperCase()}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_PILL[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="font-bold">Data:</span>{" "}
                  {new Date(order.created_at).toLocaleString("pt-BR")}
                </p>
                <p>
                  <span className="font-bold">Cliente:</span> {order.customer_name}
                </p>
                <p className="flex items-center gap-1">
                  <span className="font-bold">E-mail:</span> {order.customer_email}
                </p>
                {order.customer_phone && (
                  <p className="flex items-center gap-1">
                    <MessageCircle size={14} className="text-green-600" />
                    <a
                      href={whatsappLink(order.customer_phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-green-700 hover:underline"
                    >
                      {order.customer_phone}
                    </a>
                  </p>
                )}
                <p className="flex items-start gap-1 sm:col-span-2">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  {formatAddress(order.shipping_address)}
                </p>
                <p className="flex items-center gap-1">
                  <CreditCard size={14} className="text-slate-400" />
                  {order.payment_provider === "mercadopago" ? "Mercado Pago" : order.payment_provider}
                  {order.payment_status ? ` · ${order.payment_status}` : ""}
                </p>
                <p>
                  <span className="font-bold">Total:</span>{" "}
                  <span className="font-display text-brand">{centsToBRL(order.total_cents)}</span>
                </p>
              </div>

              <ul className="mt-3 space-y-0.5 border-t border-blue-50 pt-2 text-sm text-slate-600">
                {order.order_items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}x {item.product_name}
                    {item.flavor_name ? ` (${item.flavor_name})` : ""}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-700">Alterar status:</span>
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
