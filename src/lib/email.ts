import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { centsToBRL } from "@/lib/money";
import type { Order, OrderItem, SiteSettings } from "@/lib/types";

/**
 * E-mails da loja (pedido recebido com o Pix, pagamento aprovado, mudança
 * de status). Saem pelo SMTP configurado nas variáveis SMTP_* — pode ser o
 * mesmo Gmail + senha de app usado no SMTP do Supabase.
 */
function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

type Attachment = { filename: string; content: Buffer; cid: string };

async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  settings: SiteSettings;
  attachments?: Attachment[];
}) {
  const transport = getTransport();
  if (!transport) {
    // eslint-disable-next-line no-console
    console.warn(`SMTP não configurado — e-mail "${params.subject}" não enviado.`);
    return;
  }
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM || `${params.settings.store_name} <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
    });
  } catch (err) {
    // E-mail nunca derruba o pedido/pagamento.
    // eslint-disable-next-line no-console
    console.error("[email]", params.subject, err instanceof Error ? err.message : err);
  }
}

function appUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function shortId(order: Order) {
  return order.id.slice(0, 8).toUpperCase();
}

/** Moldura dos e-mails: cabeçalho azul com o nome da loja e cartão branco. */
function layout(settings: SiteSettings, bodyHtml: string) {
  const store = escapeHtml(settings.store_name);
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef4ff;padding:32px 12px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;">
        <tr><td align="center" style="background-color:#1d4ed8;background:linear-gradient(135deg,#2563eb 0%,#0f2f8f 100%);padding:26px 24px;">
          <span style="color:#ffffff;font-size:22px;font-weight:900;">${store}</span>
        </td></tr>
        <tr><td style="padding:28px 26px;color:#0f172a;font-size:15px;line-height:1.5;">
          ${bodyHtml}
        </td></tr>
        <tr><td align="center" style="padding:18px 24px;background:#f8fafc;color:#94a3b8;font-size:12px;">
          ${store} · e-mail automático, não precisa responder.
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

function button(href: string, label: string, primary = true) {
  const style = primary
    ? "background:#1d4ed8;color:#ffffff;border:1px solid #1d4ed8;"
    : "background:#ffffff;color:#1d4ed8;border:1px solid #bfd3ff;";
  return `<a href="${href}" style="${style}display:inline-block;padding:12px 22px;border-radius:12px;font-weight:800;font-size:14px;text-decoration:none;margin:4px;">${label}</a>`;
}

function itemsTable(order: Order, items: OrderItem[]) {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:6px 0;color:#334155;">${item.quantity}x ${escapeHtml(item.product_name)}${
          item.flavor_name ? `<br/><span style="font-size:12px;color:#64748b;">Sabor: ${escapeHtml(item.flavor_name)}</span>` : ""
        }</td>
        <td style="padding:6px 0;text-align:right;color:#334155;white-space:nowrap;">${centsToBRL(item.unit_price_cents * item.quantity)}</td>
      </tr>`
    )
    .join("");
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;font-size:14px;">
    ${rows}
    <tr><td style="padding:6px 0;color:#64748b;">Taxa de serviço</td><td style="padding:6px 0;text-align:right;color:#64748b;">${centsToBRL(order.service_fee_cents)}</td></tr>
    <tr><td style="padding:8px 0;font-weight:800;">Total</td><td style="padding:8px 0;text-align:right;font-weight:800;color:#1d4ed8;">${centsToBRL(order.total_cents)}</td></tr>
  </table>`;
}

function freightNote(order: Order) {
  return `<p style="margin:0 0 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;color:#92400e;font-size:13px;">
    ${order.shipping_fee_cents > 0 ? `<strong>Frete estimado: ${centsToBRL(order.shipping_fee_cents)}</strong><br/>` : ""}
    O frete é pago em dinheiro ou Pix direto ao entregador na hora da entrega.
  </p>`;
}

function brasiliaTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

/** Logo depois de fazer o pedido: QR code, copia e cola e link do Pix. */
export async function sendPixPendingEmail(params: { order: Order; items: OrderItem[]; settings: SiteSettings }) {
  const { order, items, settings } = params;
  const orderUrl = `${appUrl()}/pedidos/${order.id}`;
  const attachments: Attachment[] = [];

  let pixBlock = "";
  if (order.pix_qr_code) {
    const png = await QRCode.toBuffer(order.pix_qr_code, { width: 480, margin: 1 });
    attachments.push({ filename: "pix-qrcode.png", content: png, cid: "pix-qrcode" });
    pixBlock = `
      <div style="text-align:center;margin:18px 0;">
        <img src="cid:pix-qrcode" alt="QR code do Pix" width="220" height="220" style="display:inline-block;border:1px solid #dbe6ff;border-radius:14px;padding:8px;background:#ffffff;" />
      </div>
      <p style="margin:0 0 6px;font-size:13px;color:#64748b;">Ou use o <strong>Pix copia e cola</strong>:</p>
      <div style="background:#f1f5f9;border-radius:10px;padding:12px;font-family:Consolas,monospace;font-size:12px;color:#0f172a;word-break:break-all;">${escapeHtml(order.pix_qr_code)}</div>`;
  }

  const deadline = order.payment_expires_at
    ? `<p style="margin:16px 0 0;background:#eef4ff;border-radius:10px;padding:10px 12px;color:#1e3a8a;font-size:14px;">⏱️ Pague até <strong>${brasiliaTime(order.payment_expires_at)}</strong> (horário de Brasília). Depois disso o pedido é cancelado automaticamente.</p>`
    : "";

  const body = `
    <p style="margin:0 0 6px;font-size:20px;font-weight:800;">Pedido recebido! 🎉</p>
    <p style="margin:0 0 4px;color:#475569;">Olá, ${escapeHtml(order.customer_name)}! Seu pedido <strong>#${shortId(order)}</strong> está reservado. Agora é só pagar o Pix de <strong>${centsToBRL(order.total_cents)}</strong>.</p>
    ${deadline}
    ${pixBlock}
    <div style="text-align:center;margin:20px 0 6px;">
      ${order.payment_url ? button(order.payment_url, "Abrir página de pagamento") : ""}
      ${button(orderUrl, "Ver meu pedido", !order.payment_url)}
    </div>
    ${itemsTable(order, items)}
    ${freightNote(order)}`;

  await sendMail({
    to: order.customer_email,
    subject: `Pague seu pedido #${shortId(order)} com Pix - ${settings.store_name}`,
    html: layout(settings, body),
    settings,
    attachments,
  });
}

/** Pagamento aprovado pelo Mercado Pago. */
export async function sendOrderConfirmationEmail(params: { order: Order; items: OrderItem[]; settings: SiteSettings }) {
  const { order, items, settings } = params;
  const body = `
    <p style="margin:0 0 6px;font-size:20px;font-weight:800;">Pagamento aprovado! ✅</p>
    <p style="margin:0 0 4px;color:#475569;">Olá, ${escapeHtml(order.customer_name)}! Recebemos o pagamento do pedido <strong>#${shortId(order)}</strong>. Já vamos separar tudo pra entrega.</p>
    ${itemsTable(order, items)}
    ${freightNote(order)}
    <div style="text-align:center;">${button(`${appUrl()}/pedidos/${order.id}`, "Acompanhar pedido")}</div>`;

  await sendMail({
    to: order.customer_email,
    subject: `Pagamento aprovado - Pedido #${shortId(order)} - ${settings.store_name}`,
    html: layout(settings, body),
    settings,
  });
}

const STATUS_EMAIL: Record<string, { title: string; text: string }> = {
  paid: { title: "Pagamento aprovado ✅", text: "Recebemos o pagamento do seu pedido." },
  confirmed: { title: "Pedido confirmado 👍", text: "Seu pedido foi confirmado pela loja." },
  preparing: { title: "Pedido em preparação 📦", text: "Estamos separando seus produtos." },
  shipped: { title: "Saiu pra entrega 🛵", text: "O entregador já está a caminho. Lembre: o frete é pago direto a ele." },
  delivered: { title: "Pedido entregue 🎉", text: "Obrigado pela compra! Volte sempre." },
  cancelled: { title: "Pedido cancelado", text: "Seu pedido foi cancelado. Se tiver dúvidas, fale com a loja." },
};

export async function sendOrderStatusUpdateEmail(params: { order: Order; settings: SiteSettings }) {
  const { order, settings } = params;
  const info = STATUS_EMAIL[order.status];
  if (!info) return;

  const body = `
    <p style="margin:0 0 6px;font-size:20px;font-weight:800;">${info.title}</p>
    <p style="margin:0 0 20px;color:#475569;">Olá, ${escapeHtml(order.customer_name)}! ${info.text}</p>
    <p style="margin:0 0 20px;color:#475569;">Pedido <strong>#${shortId(order)}</strong> · ${centsToBRL(order.total_cents)}</p>
    <div style="text-align:center;">${button(`${appUrl()}/pedidos/${order.id}`, "Ver pedido")}</div>`;

  await sendMail({
    to: order.customer_email,
    subject: `${info.title.replace(/\s*\p{Extended_Pictographic}/gu, "")} - Pedido #${shortId(order)} - ${settings.store_name}`,
    html: layout(settings, body),
    settings,
  });
}
