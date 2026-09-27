import { Resend } from "resend";
import { centsToBRL } from "@/lib/money";
import type { Order, OrderItem, SiteSettings } from "@/lib/types";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendOrderConfirmationEmail(params: {
  order: Order;
  items: OrderItem[];
  settings: SiteSettings;
}) {
  const resend = getResend();
  if (!resend) {
    // eslint-disable-next-line no-console
    console.warn("RESEND_API_KEY não configurado — e-mail de confirmação não enviado.");
    return;
  }

  const { order, items, settings } = params;
  const from = process.env.EMAIL_FROM ?? "pedidos@resend.dev";

  const itemsHtml = items
    .map(
      (item) =>
        `<tr>
          <td style="padding:4px 8px;">${item.product_name}</td>
          <td style="padding:4px 8px;text-align:center;">${item.quantity}x</td>
          <td style="padding:4px 8px;text-align:right;">${centsToBRL(
            item.unit_price_cents * item.quantity
          )}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <h2>${settings.store_name}</h2>
      <p>Olá, ${order.customer_name}! Recebemos seu pedido <strong>#${order.id.slice(0, 8)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        ${itemsHtml}
      </table>
      <p>Subtotal: ${centsToBRL(order.subtotal_cents)}<br/>
      Frete: ${centsToBRL(order.shipping_fee_cents)}<br/>
      Taxa de serviço: ${centsToBRL(order.service_fee_cents)}<br/>
      <strong>Total: ${centsToBRL(order.total_cents)}</strong></p>
      <p>Você pode acompanhar o status do seu pedido na área "Meus pedidos" do site.</p>
    </div>
  `;

  await resend.emails.send({
    from,
    to: order.customer_email,
    subject: `Pedido confirmado - ${settings.store_name}`,
    html,
  });
}

export async function sendOrderStatusUpdateEmail(params: {
  order: Order;
  settings: SiteSettings;
}) {
  const resend = getResend();
  if (!resend) return;

  const { order, settings } = params;
  const from = process.env.EMAIL_FROM ?? "pedidos@resend.dev";

  const statusLabels: Record<string, string> = {
    paid: "Pagamento aprovado",
    confirmed: "Pedido confirmado",
    preparing: "Pedido em preparação",
    shipped: "Pedido enviado para entrega",
    delivered: "Pedido entregue",
    cancelled: "Pedido cancelado",
  };

  const label = statusLabels[order.status] ?? order.status;

  await resend.emails.send({
    from,
    to: order.customer_email,
    subject: `${label} - Pedido #${order.id.slice(0, 8)} - ${settings.store_name}`,
    html: `<p>Olá, ${order.customer_name}! O status do seu pedido #${order.id.slice(
      0,
      8
    )} mudou para: <strong>${label}</strong>.</p>`,
  });
}
