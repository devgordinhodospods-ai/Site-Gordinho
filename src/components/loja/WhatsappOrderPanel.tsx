"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { centsToBRL } from "@/lib/money";
import { orderCode } from "@/lib/orderCode";
import type { Order, OrderItem } from "@/lib/types";

function addressLine(address: Record<string, unknown>) {
  const a = address as Record<string, string | undefined>;
  if (!a.street) return "";
  return [
    `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""}`,
    a.neighborhood,
    `${a.city}/${a.state}`,
    a.zip ? `CEP ${a.zip}` : "",
  ]
    .filter(Boolean)
    .join(" - ");
}

/** Texto do pedido que vai pronto pro WhatsApp da loja. */
function orderMessage(order: Order & { order_items: OrderItem[] }) {
  const lines = [
    `🛒 *NOVO PEDIDO #${orderCode(order)}*`,
    "",
    ...order.order_items.map(
      (i) =>
        `• ${i.quantity}x ${i.product_name}${i.flavor_name ? ` (${i.flavor_name})` : ""} — ${centsToBRL(
          i.unit_price_cents * i.quantity
        )}`
    ),
    "",
    `Subtotal: ${centsToBRL(order.subtotal_cents)}`,
    order.service_fee_cents > 0 ? `Taxa de serviço: ${centsToBRL(order.service_fee_cents)}` : "",
    `*Total a pagar: ${centsToBRL(order.total_cents)}*`,
    order.shipping_fee_cents > 0 ? `Frete estimado (pago ao entregador): ${centsToBRL(order.shipping_fee_cents)}` : "",
    "",
    `👤 ${order.customer_name}`,
    order.customer_phone ? `📞 ${order.customer_phone}` : "",
    addressLine(order.shipping_address) ? `📍 ${addressLine(order.shipping_address)}` : "",
    "",
    "Pode me mandar o Pix pra eu pagar? 🙏",
  ];
  return lines.filter((l, idx, arr) => l !== "" || arr[idx - 1] !== "").join("\n");
}

/**
 * Pagamento pelo WhatsApp (sem empresa de pagamento integrada): o cliente
 * manda o pedido pronto pra loja, que responde com o Pix e confirma no painel.
 */
export function WhatsappOrderPanel({ order }: { order: Order & { order_items: OrderItem[] } }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((data) => setPhone(data.orderWhatsapp ?? null))
      .catch(() => null)
      .finally(() => setLoaded(true));
  }, []);

  const digits = phone ? (phone.length <= 11 ? `55${phone}` : phone) : null;
  const link = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(orderMessage(order))}` : null;

  return (
    <div className="card mb-4 overflow-hidden border border-green-100">
      <div className="theme-static bg-[#128C7E] px-5 py-4 text-white">
        <p className="font-display text-lg">Falta só enviar o pedido!</p>
        <p className="text-sm text-white/90">Total: {centsToBRL(order.total_cents)}</p>
      </div>
      <div className="space-y-3 p-5 text-sm text-slate-700">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Toque no botão abaixo: o pedido já vai escrito pro WhatsApp da loja.</li>
          <li>A loja te responde com o Pix pra pagamento.</li>
          <li>Assim que a loja confirmar o pagamento, o status muda aqui.</li>
        </ol>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-display text-white shadow-sm transition hover:brightness-95"
          >
            <MessageCircle size={20} /> Enviar pedido no WhatsApp
          </a>
        ) : (
          loaded && (
            <p className="rounded-lg bg-amber-50 p-3 text-amber-800">
              Não encontramos o WhatsApp da loja. Fale com a gente pelos contatos do rodapé informando o pedido #
              {orderCode(order)}.
            </p>
          )
        )}
        <p className="text-xs text-slate-500">
          Seu pedido fica reservado por algumas horas, até a confirmação do pagamento.
        </p>
      </div>
    </div>
  );
}
