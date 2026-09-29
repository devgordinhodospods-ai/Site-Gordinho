import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPayment } from "@/lib/mercadopago";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/settings";
import { cancelExpiredOrder } from "@/lib/orders";
import { sendNewOrderAlert, sendPaidAfterCancelAlert } from "@/lib/whatsappAlert";

type MpPayment = Awaited<ReturnType<typeof getPayment>>;

/**
 * Aplica no pedido o status de um pagamento do Mercado Pago. Usado pelo
 * webhook e também pela página do pedido (caso o webhook se perca).
 *
 * As mudanças são "atômicas": só quem muda o pedido de verdade manda o
 * e-mail e o WhatsApp — então avisos repetidos do MP nunca duplicam nada.
 */
export async function applyPayment(payment: MpPayment) {
  const orderId = payment.external_reference;
  if (!orderId) return;
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (payment.status === "approved") {
    // aguardando → pago (só um processo consegue fazer essa troca)
    const { count } = await db
      .from("orders")
      .update(
        { status: "paid", payment_id: String(payment.id), payment_status: "approved", updated_at: now },
        { count: "exact" }
      )
      .eq("id", orderId)
      .eq("status", "awaiting_payment");

    if (count) {
      await notifyPaid(orderId);
      return;
    }

    // Pago num pedido que já tinha sido cancelado (ex.: Pix pago no último segundo).
    const { count: lateCount } = await db
      .from("orders")
      .update({ payment_id: String(payment.id), payment_status: "approved", updated_at: now }, { count: "exact" })
      .eq("id", orderId)
      .eq("status", "cancelled")
      .or("payment_status.is.null,payment_status.neq.approved");
    if (lateCount) {
      // eslint-disable-next-line no-console
      console.error(`[pagamento] Pix aprovado em pedido já cancelado: ${orderId}`);
      const [{ data: order }, settings] = await Promise.all([
        db.from("orders").select("*").eq("id", orderId).single(),
        getSiteSettings(),
      ]);
      if (order) await sendPaidAfterCancelAlert({ order, settings });
    }
    return;
  }

  // Pix vencido no Mercado Pago: cancela, devolve o estoque e avisa o cliente.
  if (payment.status === "cancelled") {
    await cancelExpiredOrder(orderId);
    return;
  }

  // Outros status (pending, in_process...) só ficam registrados.
  await db
    .from("orders")
    .update({ payment_status: payment.status, updated_at: now })
    .eq("id", orderId)
    .eq("status", "awaiting_payment");
}

async function notifyPaid(orderId: string) {
  const db = getSupabaseAdmin();
  const [{ data: order }, { data: items }, settings] = await Promise.all([
    db.from("orders").select("*").eq("id", orderId).single(),
    db.from("order_items").select("*").eq("order_id", orderId),
    getSiteSettings(),
  ]);
  if (!order) return;
  // Um aviso nunca impede o outro.
  await Promise.allSettled([
    sendOrderConfirmationEmail({ order, items: items ?? [], settings }),
    sendNewOrderAlert({ order, items: items ?? [], settings }),
  ]);
}

/** Pergunta ao Mercado Pago como está o Pix de um pedido e aplica o resultado. */
export async function syncOrderPayment(order: { id: string; status: string; payment_id: string | null; pix_qr_code?: string | null }) {
  // Só pedidos com Pix gerado pela API (o id da preferência antiga não é um pagamento).
  if (order.status !== "awaiting_payment" || !order.payment_id || !order.pix_qr_code) return;
  try {
    await applyPayment(await getPayment(order.payment_id));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[pagamento] consulta ao Mercado Pago:", order.id, err instanceof Error ? err.message : err);
  }
}
