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

type SendResult = { sent: true } | { sent: false; error: string };

async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  settings: SiteSettings;
  attachments?: Attachment[];
}): Promise<SendResult> {
  const transport = getTransport();
  if (!transport) {
    // eslint-disable-next-line no-console
    console.warn(`SMTP não configurado — e-mail "${params.subject}" não enviado.`);
    return { sent: false, error: "SMTP não configurado (variáveis SMTP_HOST, SMTP_USER e SMTP_PASS na Vercel)." };
  }
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM || `${params.settings.store_name} <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
    });
    return { sent: true };
  } catch (err) {
    // E-mail nunca derruba o pedido/pagamento.
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[email]", params.subject, message);
    return { sent: false, error: message };
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

// Paleta escura — mesma do e-mail de código do Supabase (modelo "escuro").
const C = {
  page: "#05070f",
  card: "#0b1224",
  line: "#1e2b4d",
  box: "#111c38",
  blue: "#2563eb",
  neon: "#60a5fa",
  title: "#ffffff",
  text: "#cbd5e1",
  muted: "#94a3b8",
  faint: "#64748b",
};

/** Nome da loja com a parte "Dos..." em azul, igual ao e-mail de código. */
function brandName(storeName: string) {
  const name = escapeHtml(storeName);
  return name.replace(/(Dos\w+)$/, `<span style="color:#3b82f6;">$1</span>`);
}

/** Moldura dos e-mails: fundo escuro, cartão azul-marinho, rodapé discreto. */
function layout(settings: SiteSettings, bodyHtml: string) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:36px 12px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background:${C.card};border:1px solid ${C.line};border-radius:18px;">
        <tr><td align="center" style="padding:30px 24px 6px;">
          <span style="color:#ffffff;font-size:24px;font-weight:900;">${brandName(settings.store_name)}</span>
        </td></tr>
        <tr><td style="padding:18px 26px 26px;color:${C.text};font-size:15px;line-height:1.55;">
          ${bodyHtml}
        </td></tr>
        <tr><td align="center" style="padding:22px 24px;color:#475569;font-size:12px;border-top:1px solid ${C.line};">
          © ${escapeHtml(settings.store_name)} · e-mail automático, não precisa responder.
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

function heading(title: string, text: string) {
  return `<p style="margin:0 0 8px;font-size:20px;font-weight:800;color:${C.title};text-align:center;">${title}</p>
    <p style="margin:0 0 20px;color:${C.muted};text-align:center;">${text}</p>`;
}

function button(href: string, label: string, primary = true) {
  const style = primary
    ? `background:${C.blue};color:#ffffff;border:1px solid ${C.blue};`
    : `background:transparent;color:${C.neon};border:1px solid ${C.blue};`;
  return `<a href="${href}" style="${style}display:inline-block;padding:12px 22px;border-radius:12px;font-weight:800;font-size:14px;text-decoration:none;margin:4px;">${label}</a>`;
}

function itemsTable(order: Order, items: OrderItem[]) {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:7px 0;color:${C.text};">${item.quantity}x ${escapeHtml(item.product_name)}${
          item.flavor_name ? `<br/><span style="font-size:12px;color:${C.faint};">Sabor: ${escapeHtml(item.flavor_name)}</span>` : ""
        }</td>
        <td style="padding:7px 0;text-align:right;color:${C.text};white-space:nowrap;">${centsToBRL(item.unit_price_cents * item.quantity)}</td>
      </tr>`
    )
    .join("");
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};font-size:14px;">
    ${rows}
    <tr><td style="padding:7px 0;color:${C.muted};">Taxa de serviço</td><td style="padding:7px 0;text-align:right;color:${C.muted};">${centsToBRL(order.service_fee_cents)}</td></tr>
    <tr><td style="padding:9px 0;font-weight:800;color:${C.title};">Total</td><td style="padding:9px 0;text-align:right;font-weight:800;color:${C.neon};">${centsToBRL(order.total_cents)}</td></tr>
  </table>`;
}

function freightNote(order: Order) {
  return `<p style="margin:0 0 18px;background:#1f1706;border:1px solid #854d0e;border-radius:12px;padding:11px 13px;color:#fcd34d;font-size:13px;">
    ${order.shipping_fee_cents > 0 ? `<strong>Frete estimado: ${centsToBRL(order.shipping_fee_cents)}</strong><br/>` : ""}
    🛵 O frete é pago em dinheiro ou Pix direto ao entregador na hora da entrega.
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
    const png = await QRCode.toBuffer(order.pix_qr_code, { width: 480, margin: 2 });
    attachments.push({ filename: "pix-qrcode.png", content: png, cid: "pix-qrcode" });
    pixBlock = `
      <div style="text-align:center;margin:22px 0 18px;">
        <img src="cid:pix-qrcode" alt="QR code do Pix" width="210" height="210" style="display:inline-block;background:#ffffff;border-radius:14px;padding:8px;border:2px solid ${C.blue};" />
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:${C.muted};text-align:center;">Ou use o <strong style="color:${C.title};">Pix copia e cola</strong>:</p>
      <div style="background:${C.box};border:1px solid ${C.line};border-radius:12px;padding:12px;font-family:Consolas,monospace;font-size:12px;color:#e2e8f0;word-break:break-all;">${escapeHtml(order.pix_qr_code)}</div>`;
  }

  const deadline = order.payment_expires_at
    ? `<div style="background:${C.box};border:1px solid ${C.blue};border-radius:14px;padding:16px;text-align:center;">
        <span style="display:block;font-size:13px;color:${C.muted};">Pague até</span>
        <span style="display:block;font-size:34px;font-weight:900;letter-spacing:2px;color:${C.neon};">${brasiliaTime(order.payment_expires_at)}</span>
        <span style="display:block;font-size:12px;color:${C.faint};">horário de Brasília · depois disso o pedido é cancelado</span>
      </div>`
    : "";

  const body = `
    ${heading("Seu pedido está reservado 🔐", `Olá, ${escapeHtml(order.customer_name)}! Pague o Pix de <strong style="color:${C.title};">${centsToBRL(order.total_cents)}</strong> do pedido <strong style="color:${C.title};">#${shortId(order)}</strong> pra confirmar.`)}
    ${deadline}
    ${pixBlock}
    <div style="text-align:center;margin:22px 0 4px;">
      ${order.payment_url ? button(order.payment_url, "Abrir página de pagamento") : ""}
      ${button(orderUrl, "Ver meu pedido", !order.payment_url)}
    </div>
    ${itemsTable(order, items)}
    ${freightNote(order)}`;

  return sendMail({
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
    ${heading("Pagamento aprovado ✅", `Olá, ${escapeHtml(order.customer_name)}! Recebemos o pagamento do pedido <strong style="color:${C.title};">#${shortId(order)}</strong>. Já vamos separar tudo pra entrega.`)}
    ${itemsTable(order, items)}
    ${freightNote(order)}
    <div style="text-align:center;">${button(`${appUrl()}/pedidos/${order.id}`, "Acompanhar pedido")}</div>`;

  return sendMail({
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
};

export async function sendOrderStatusUpdateEmail(params: { order: Order; settings: SiteSettings }) {
  const { order, settings } = params;
  const info = STATUS_EMAIL[order.status];
  if (!info) return;

  const body = `
    ${heading(info.title, `Olá, ${escapeHtml(order.customer_name)}! ${info.text}`)}
    <div style="background:${C.box};border:1px solid ${C.line};border-radius:14px;padding:14px;text-align:center;margin:0 0 20px;">
      <span style="font-size:13px;color:${C.muted};">Pedido</span>
      <span style="display:block;font-size:22px;font-weight:900;letter-spacing:2px;color:${C.neon};">#${shortId(order)}</span>
      <span style="font-size:13px;color:${C.muted};">${centsToBRL(order.total_cents)}</span>
    </div>
    <div style="text-align:center;">${button(`${appUrl()}/pedidos/${order.id}`, "Ver pedido")}</div>`;

  await sendMail({
    to: order.customer_email,
    subject: `${info.title.replace(/\s*\p{Extended_Pictographic}/gu, "")} - Pedido #${shortId(order)} - ${settings.store_name}`,
    html: layout(settings, body),
    settings,
  });
}

function whatsappLink(phone: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`}`;
}

export type CancelReason = "expired" | "store_paid" | "store_unpaid";

/**
 * Pedido cancelado: prazo do Pix esgotado, ou cancelado pela loja (ex.: falta
 * de estoque) — nesse caso avisa que a loja vai entrar em contato.
 */
export async function sendOrderCancelledEmail(params: { order: Order; settings: SiteSettings; reason: CancelReason }) {
  const { order, settings, reason } = params;
  const name = escapeHtml(order.customer_name);
  const id = `<strong style="color:${C.title};">#${shortId(order)}</strong>`;

  const texts: Record<CancelReason, { title: string; text: string; note: string }> = {
    expired: {
      title: "Pedido cancelado ⏱️",
      text: `Olá, ${name}! O prazo de 30 minutos pra pagar o Pix do pedido ${id} acabou e o pagamento não foi identificado, então o pedido foi cancelado.`,
      note: "Nenhum valor foi cobrado. Se ainda quiser os produtos, é só fazer o pedido de novo no site.",
    },
    store_paid: {
      title: "Pedido cancelado",
      text: `Olá, ${name}! Infelizmente precisamos cancelar o pedido ${id} por falta de estoque ou outro problema com os produtos.`,
      note: "Fique tranquilo: a loja vai entrar em contato com você por e-mail ou WhatsApp pra resolver e combinar a devolução do valor pago.",
    },
    store_unpaid: {
      title: "Pedido cancelado",
      text: `Olá, ${name}! O pedido ${id} foi cancelado pela loja.`,
      note: "Nenhum valor foi cobrado. Se tiver alguma dúvida, é só falar com a gente.",
    },
  };
  const t = texts[reason];

  const whatsapp = whatsappLink(settings.contact_whatsapp);
  const contactButtons =
    reason === "expired"
      ? button(appUrl(), "Voltar pra loja")
      : [
          whatsapp ? button(whatsapp, "Falar no WhatsApp") : "",
          settings.contact_email ? button(`mailto:${settings.contact_email}`, "Mandar e-mail", !whatsapp) : "",
        ].join("") || button(appUrl(), "Voltar pra loja");

  const body = `
    ${heading(t.title, t.text)}
    <div style="background:${C.box};border:1px solid ${C.line};border-radius:14px;padding:14px;text-align:center;margin:0 0 16px;">
      <span style="font-size:13px;color:${C.muted};">Pedido</span>
      <span style="display:block;font-size:22px;font-weight:900;letter-spacing:2px;color:${C.neon};">#${shortId(order)}</span>
      <span style="font-size:13px;color:${C.muted};">${centsToBRL(order.total_cents)}</span>
    </div>
    <p style="margin:0 0 20px;background:${reason === "store_paid" ? "#1f1706" : C.box};border:1px solid ${reason === "store_paid" ? "#854d0e" : C.line};border-radius:12px;padding:12px 14px;color:${reason === "store_paid" ? "#fcd34d" : C.text};font-size:14px;text-align:center;">${t.note}</p>
    <div style="text-align:center;">${contactButtons}</div>`;

  return sendMail({
    to: order.customer_email,
    subject: `Pedido #${shortId(order)} cancelado - ${settings.store_name}`,
    html: layout(settings, body),
    settings,
  });
}
