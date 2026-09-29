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
  return `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""} · ${a.neighborhood} · ${a.city}`;
}

export function newOrderAlertText(order: Order, items: OrderItem[]) {
  const lines = [
    "🛒 *Pedido novo pago!*",
    `*#${orderCode(order)}* · ${centsToBRL(order.total_cents)}`,
    "",
    ...items.map((i) => `• ${i.quantity}x ${i.product_name}${i.flavor_name ? ` (${i.flavor_name})` : ""}`),
    "",
  ];
  const address = formatAddress(order.shipping_address);
  if (address) lines.push(`📍 ${address}`);
  const phone = (order.customer_phone ?? "").replace(/\D/g, "");
  lines.push(`👤 ${order.customer_name}${phone ? ` · wa.me/${phone.length <= 11 ? `55${phone}` : phone}` : ""}`);
  if (order.shipping_fee_cents > 0) lines.push(`🛵 Frete a cobrar na entrega: ${centsToBRL(order.shipping_fee_cents)}`);
  lines.push("", `Painel: ${process.env.APP_URL ?? ""}/admin/pedidos`);
  return lines.join("\n");
}

/** Avisa a loja no WhatsApp que caiu um pedido pago (nunca derruba o webhook). */
export async function sendNewOrderAlert(params: { order: Order; items: OrderItem[]; settings: SiteSettings }) {
  const to = params.settings.whatsapp_alert_number;
  if (!to || !whatsappAlertConfigured()) return;
  const result = await sendWhatsappText(to, newOrderAlertText(params.order, params.items));
  // eslint-disable-next-line no-console
  if (!result.ok) console.error("[whatsapp-alert]", result.error);
}
