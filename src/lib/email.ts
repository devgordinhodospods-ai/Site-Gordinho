import { Resend } from "resend";
import { centsToBRL } from "@/lib/money";
import type { Order, OrderItem, SiteSettings } from "@/lib/types";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/**
 * Moldura visual compartilhada pelos e-mails transacionais — cabeçalho azul
 * com o nome/logo da loja, cartão branco com o conteúdo e rodapé discreto.
 * Fontes ficam nos web-safe padrão (Lato não é suportada pela maioria dos
 * clientes de e-mail), mas as cores seguem a mesma identidade do site.
 */
function renderEmailLayout(params: { storeName: string; logoUrl?: string | null; bodyHtml: string }) {
  const { storeName, logoUrl, bodyHtml } = params;

  return `
  <div style="background:#eef4ff;padding:32px 16px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(29,78,216,0.12);">
      <div style="background:linear-gradient(135deg,#2563eb 0%,#0f2f8f 100%);padding:28px 24px;text-align:center;">
        ${
          logoUrl
            ? `<img src="${logoUrl}" alt="${storeName}" width="40" height="40" style="border-radius:8px;display:block;margin:0 auto 8px;" />`
            : ""
        }
        <span style="color:#ffffff;font-size:20px;font-weight:800;">${storeName}</span>
      </div>
      <div style="padding:28px 24px;color:#1e293b;">
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">
        ${storeName} · Este é um e-mail automático, não é preciso responder.
      </div>
    </div>
  </div>`;
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
          <td style="padding:4px 8px;">${item.product_name}${
          item.flavor_name ? ` (${item.flavor_name})` : ""
        }</td>
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
      Taxa de serviço: ${centsToBRL(order.service_fee_cents)}<br/>
      <strong>Total pago no site: ${centsToBRL(order.total_cents)}</strong></p>
      ${
        `<p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;color:#92400e;">
          ${order.shipping_fee_cents > 0 ? `<strong>Frete estimado: ${centsToBRL(order.shipping_fee_cents)}</strong><br/>` : ""}
          O frete é pago em dinheiro ou Pix direto ao entregador na hora da entrega.
        </p>`
      }
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

export async function sendEmailChangeCode(params: {
  toEmail: string;
  customerName: string;
  code: string;
  settings: SiteSettings;
}): Promise<{ sent: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    // eslint-disable-next-line no-console
    console.warn("RESEND_API_KEY não configurado — código de troca de e-mail não enviado.");
    return { sent: false, error: "Envio de e-mail não configurado (RESEND_API_KEY ausente)." };
  }

  const { toEmail, customerName, code, settings } = params;
  const from = process.env.EMAIL_FROM ?? "pedidos@resend.dev";

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;">Olá, ${customerName}!</p>
    <p style="margin:0 0 20px;font-size:15px;">
      Recebemos um pedido para usar este e-mail como o novo e-mail de login da sua conta em
      <strong>${settings.store_name}</strong>. Use o código abaixo para confirmar:
    </p>
    <div style="background:#eef4ff;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px;">
      <span style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1d4ed8;">${code}</span>
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;">
      O código expira em 15 minutos. Se você não solicitou essa troca, pode ignorar este e-mail com
      segurança — seu e-mail de login continua o mesmo.
    </p>
  `;

  const { error } = await resend.emails.send({
    from,
    to: toEmail,
    subject: `${code} é o seu código de confirmação - ${settings.store_name}`,
    html: renderEmailLayout({ storeName: settings.store_name, logoUrl: settings.store_logo_url, bodyHtml }),
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[sendEmailChangeCode] Resend error:", error.message);
    return { sent: false, error: error.message };
  }

  return { sent: true };
}
