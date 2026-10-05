"use client";

import { useEffect, useState } from "react";
import { MessageCircle, MapPin, CreditCard, Store, Trash2 } from "lucide-react";
import { InStoreSaleDialog, PAYMENT_METHOD_LABELS } from "@/components/admin/InStoreSaleDialog";
import { NEW_ORDER_EVENT } from "@/components/admin/NewOrderAlert";
import { adminApi } from "@/lib/adminApi";
import { centsToBRL } from "@/lib/money";
import { HelpTip } from "@/components/ui/HelpTip";
import { Pagination } from "@/components/ui/Pagination";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PeriodFilter, isWithinPeriod, type Period } from "@/components/ui/PeriodFilter";
import type { Order, OrderItem, OrderStatus } from "@/lib/types";
import { orderCode } from "@/lib/orderCode";

const STATUS_FLOW: OrderStatus[] = [
  "awaiting_payment",
  "paid",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pix aguardando pagamento",
  approved: "pagamento aprovado",
  expired: "Pix vencido",
  cancelled: "pagamento cancelado",
  rejected: "pagamento recusado",
  in_process: "pagamento em análise",
  refunded: "valor devolvido",
};

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

type Channel = "" | "site" | "balcao";

const isInStore = (o: Pick<Order, "payment_provider">) => o.payment_provider === "balcao";

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const [channel, setChannel] = useState<Channel>("");
  const [saleOpen, setSaleOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { confirm, dialog } = useConfirm();

  async function load() {
    setLoading(true);
    const { orders } = await adminApi<{ orders: OrderWithItems[] }>("listOrders", {
      status: filter || undefined,
    });
    setOrders(orders);
    setLoading(false);
  }

  useEffect(() => setPage(1), [period, filter, channel]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Entrou pedido pago novo (aviso do painel): recarrega a lista sozinha.
  useEffect(() => {
    const reload = () => load();
    window.addEventListener(NEW_ORDER_EVENT, reload);
    return () => window.removeEventListener(NEW_ORDER_EVENT, reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function deleteOrder(order: OrderWithItems) {
    setActionError(null);
    const message =
      order.status === "awaiting_payment"
        ? "O pedido ainda não foi pago: ele será cancelado (os itens voltam pro estoque) e apagado."
        : order.status === "cancelled"
          ? "O pedido some da lista de vez (o estoque já tinha voltado quando ele foi cancelado)."
          : order.status === "delivered"
            ? 'Pedido entregue: o estoque NÃO volta — ele só some da lista e do Monitoramento. Se foi reembolso com o produto devolvido, mude o status pra "Cancelado" antes (aí os itens voltam pro estoque).'
            : "Os itens voltam pro estoque e o pedido some da lista e do Monitoramento. Se o cliente já pagou, lembre de devolver o valor pelo Mercado Pago.";
    const ok = await confirm(message, {
      title: `Excluir o pedido #${orderCode(order)}?`,
      confirmLabel: "Excluir pedido",
    });
    if (!ok) return;
    try {
      await adminApi("deleteOrder", { id: order.id });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível excluir o pedido.");
    }
    await load();
  }

  async function updateStatus(id: string, status: OrderStatus) {
    if (
      status === "cancelled" &&
      !(await confirm(
        "Os itens voltam pro estoque e o pedido não poderá ser reaberto depois.",
        { title: "Cancelar este pedido?", confirmLabel: "Cancelar pedido" }
      ))
    ) {
      return;
    }
    setActionError(null);
    try {
      await adminApi("updateOrderStatus", { id, status });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível alterar o status.");
    }
    await load();
  }

  const visibleOrders = orders.filter(
    (o) =>
      isWithinPeriod(o.created_at, period) &&
      (!channel || (channel === "balcao" ? isInStore(o) : !isInStore(o)))
  );

  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(visibleOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = visibleOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-slate-900">Pedidos</h1>
          {!loading && (
            <p className="text-sm text-slate-500">
              {visibleOrders.length} {visibleOrders.length === 1 ? "pedido" : "pedidos"} no período
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" onClick={() => setSaleOpen(true)}>
            <Store size={18} /> Venda no balcão
          </button>
          <select className="input w-56" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todos os status</option>
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        <div className="flex gap-1 rounded-full border border-blue-100 bg-white p-1 text-sm">
          {(
            [
              ["", "Todos"],
              ["site", "Site"],
              ["balcao", "Balcão"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setChannel(value)}
              className={`rounded-full px-3 py-1 transition ${
                channel === value ? "bg-brand text-white" : "text-slate-600 hover:text-brand"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {actionError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : visibleOrders.length === 0 ? (
        <p className="text-slate-500">Nenhum pedido encontrado.</p>
      ) : (
        <div className="space-y-3">
          {pageItems.map((order) => (
            <div key={order.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-display flex items-center gap-2 text-brand">
                  {isInStore(order) ? "Venda" : "Pedido"} #{orderCode(order)}
                  {isInStore(order) && (
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      <Store size={12} /> Balcão
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_PILL[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    onClick={() => deleteOrder(order)}
                    aria-label="Excluir pedido"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {order.status === "cancelled" && order.payment_status === "approved" && (
                <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">
                  Atenção: o Mercado Pago aprovou um pagamento deste pedido depois que ele foi cancelado. Confira no
                  Mercado Pago e faça o estorno ou fale com o cliente.
                </p>
              )}

              <div className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="font-bold">Data:</span>{" "}
                  {new Date(order.created_at).toLocaleString("pt-BR")}
                </p>
                <p>
                  <span className="font-bold">Cliente:</span> {order.customer_name}
                </p>
                {order.customer_email && (
                  <p className="flex items-center gap-1">
                    <span className="font-bold">E-mail:</span> {order.customer_email}
                  </p>
                )}
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
                {isInStore(order) ? (
                  typeof order.shipping_address?.observacao === "string" &&
                  order.shipping_address.observacao && (
                    <p className="sm:col-span-2">
                      <span className="font-bold">Obs.:</span> {order.shipping_address.observacao}
                    </p>
                  )
                ) : (
                  <p className="flex items-start gap-1 sm:col-span-2">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    {formatAddress(order.shipping_address)}
                  </p>
                )}
                <p className="flex items-center gap-1">
                  <CreditCard size={14} className="text-slate-400" />
                  {isInStore(order)
                    ? `No balcão · ${PAYMENT_METHOD_LABELS[order.payment_status ?? ""] ?? order.payment_status}`
                    : `${order.payment_provider === "mercadopago" ? "Mercado Pago" : order.payment_provider}${
                        order.payment_status
                          ? ` · ${PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}`
                          : ""
                      }`}
                </p>
                <p>
                  <span className="font-bold">
                    {isInStore(order)
                      ? "Total da venda:"
                      : order.status === "awaiting_payment"
                      ? "Total a pagar:"
                      : order.status === "cancelled"
                        ? "Total do pedido:"
                        : "Total pago no site:"}
                  </span>{" "}
                  <span className="font-display text-brand">{centsToBRL(order.total_cents)}</span>
                </p>
                {order.shipping_fee_cents > 0 && (
                  <p className="text-amber-700">
                    <span className="font-bold">Frete a cobrar do cliente na entrega:</span>{" "}
                    {centsToBRL(order.shipping_fee_cents)}
                  </p>
                )}
              </div>

              <ul className="mt-3 space-y-0.5 border-t border-blue-50 pt-2 text-sm text-slate-600">
                {order.order_items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}x {item.product_name}
                    {item.flavor_name ? ` (${item.flavor_name})` : ""}
                  </li>
                ))}
              </ul>

              {order.status === "cancelled" ? (
                <p className="mt-3 text-sm text-slate-500">
                  Pedido cancelado — os itens já voltaram pro estoque e ele não pode ser reaberto.
                </p>
              ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">
                    Alterar status:
                    <HelpTip text="Muda a etapa do pedido — o cliente recebe um e-mail avisando da mudança. Escolher 'Cancelado' devolve o estoque automaticamente." />
                  </span>
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
              )}
            </div>
          ))}
        </div>
      )}
      <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
      {dialog}
      {saleOpen && <InStoreSaleDialog onClose={() => setSaleOpen(false)} onSaved={() => load()} />}
    </div>
  );
}
