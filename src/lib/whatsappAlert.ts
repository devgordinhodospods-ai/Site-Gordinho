import { centsToBRL } from "@/lib/money";
import { orderCode } from "@/lib/orderCode";
import type { Order, OrderItem, SiteSettings } from "@/lib/types";

/**
 * Avisos de pedido por WhatsApp, via o serviço whatsapp-alert (pasta do
 * mesmo nome, rodando no Railway com o WhatsApp do dono conectado por QR).
 */
function serviceConfig() {
  const url = process.env.WHATSAPP_ALERT_URL?.replace(/\/+$/, "");
  const token = process.env.WHATSAPP_ALERT_TOKEN;
  return url && token ? { url, token } : null;
}

export function whatsappAlertConfigured() {
  return serviceConfig() != null;
}

/** Link da página do serviço com o QR code (só pro painel do admin). */
export function whatsappQrPageUrl() {
  const cfg = serviceConfig();
  return cfg ? `${cfg.url}/?token=${encodeURIComponent(cfg.token)}` : null;
}

export async function getWhatsappStatus(): Promise<{ status: string; number: string | null } | { error: string }> {
  const cfg = serviceConfig();
  if (!cfg) return { error: "Serviço de WhatsApp não configurado na Vercel (WHATSAPP_ALERT_URL e WHATSAPP_ALERT_TOKEN)." };
  try {
    const res = await fetch(`${cfg.url}/health`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? `O serviço respondeu ${res.status}.` };
    return { status: data.status, number: data.number ?? null };
  } catch {
    return { error: "Não foi possível falar com o serviço de WhatsApp (ele está no ar no Railway?)." };
  }
}

export async function sendWhatsappText(to: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = serviceConfig();
  if (!cfg) return { ok: false, error: "Serviço de WhatsApp não configurado na Vercel." };
  try {
    const res = await fetch(`${cfg.url}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, text }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? `O serviço respondeu ${res.status}.` };
  } catch {
    return { ok: false, error: "Não foi possível falar com o serviço de WhatsApp." };
  }
}

function formatAddress(address: Record<string, unknown>) {
  const a = address as Record<string, string | undefined>;
  if (!a.street) return null;
  return [
    `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""}`,
    a.neighborhood,
    [a.city, a.state].filter(Boolean).join(" - "),
    a.zip,
  ]
    .filter(Boolean)
    .join(" - ");
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function customerWhatsapp(phone: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `+${full}`;
}

/**
 * Mesmas informações do card do pedido no painel. `manual`: o operador
 * confirmou o pedido no painel (ex.: pagamento em dinheiro), não o Pix.
 */
export function newOrderAlertText(order: Order, items: OrderItem[], opts: { manual?: boolean } = {}) {
  const address = formatAddress(order.shipping_address);
  const phone = customerWhatsapp(order.customer_phone);
  const lines = [
    opts.manual ? "🛒 *Pedido confirmado no painel!*" : "🛒 *Pedido novo pago!*",
    "",
    `*Pedido #${orderCode(order)}*`,
    `*Data:* ${formatDateTime(order.created_at)}`,
    `*Cliente:* ${order.customer_name}`,
    `*E-mail:* ${order.customer_email}`,
    phone ? `*WhatsApp:* ${phone}` : null,
    address ? `*Endereço:* ${address}` : null,
    opts.manual
      ? "*Pagamento:* confirmado manualmente no painel ✅"
      : "*Pagamento:* Mercado Pago · Pix aprovado ✅",
    `*${opts.manual ? "Total do pedido" : "Total pago no site"}:* ${centsToBRL(order.total_cents)}`,
    order.shipping_fee_cents > 0
      ? `*Frete a cobrar do cliente na entrega:* ${centsToBRL(order.shipping_fee_cents)}`
      : "*Frete:* combinar com o cliente na entrega",
    "",
    "*Itens:*",
    ...items.map((i) => `• ${i.quantity}x ${i.product_name}${i.flavor_name ? ` (${i.flavor_name})` : ""}`),
    "",
    `Painel: ${process.env.APP_URL ?? ""}/admin/pedidos`,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/** Envia pro WhatsApp da loja, com uma 2ª tentativa se a 1ª falhar. */
async function alertStore(settings: SiteSettings, text: string) {
  const to = settings.whatsapp_alert_number;
  if (!to || !whatsappAlertConfigured()) return;
  let result = await sendWhatsappText(to, text);
  if (!result.ok) {
    await new Promise((r) => setTimeout(r, 3000));
    result = await sendWhatsappText(to, text);
  }
  // eslint-disable-next-line no-console
  if (!result.ok) console.error("[whatsapp-alert]", result.error);
}

/** Avisa a loja no WhatsApp que caiu um pedido pago (nunca derruba o webhook). */
export async function sendNewOrderAlert(params: {
  order: Order;
  items: OrderItem[];
  settings: SiteSettings;
  manual?: boolean;
}) {
  await alertStore(params.settings, newOrderAlertText(params.order, params.items, { manual: params.manual }));
}

/** Pix aprovado num pedido que já estava cancelado: o dono precisa resolver. */
export async function sendPaidAfterCancelAlert(params: { order: Order; settings: SiteSettings }) {
  const { order } = params;
  const phone = (order.customer_phone ?? "").replace(/\D/g, "");
  const text = [
    "⚠️ *Pix pago em pedido cancelado*",
    `*#${orderCode(order)}* · ${centsToBRL(order.total_cents)}`,
    "",
    "O cliente pagou depois que o pedido já tinha sido cancelado (prazo do Pix). O dinheiro entrou na conta do Mercado Pago.",
    "Fale com o cliente pra entregar mesmo assim ou devolver o valor.",
    "",
    `👤 ${order.customer_name}${phone ? ` · wa.me/${phone.length <= 11 ? `55${phone}` : phone}` : ""}`,
    `Painel: ${process.env.APP_URL ?? ""}/admin/pedidos`,
  ].join("\n");
  await alertStore(params.settings, text);
}

/** O cliente confirmou pelo site que recebeu o pedido. */
export async function sendDeliveryConfirmedAlert(params: { order: Order; settings: SiteSettings }) {
  const { order } = params;
  const text = [
    "✅ *Entrega confirmada pelo cliente*",
    `*Pedido #${orderCode(order)}* · ${order.customer_name}`,
    `*Total:* ${centsToBRL(order.total_cents)}`,
  ].join("\n");
  await alertStore(params.settings, text);
}
