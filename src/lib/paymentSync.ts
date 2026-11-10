import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPaymentState, type PaymentState } from "@/lib/mercadopago";
import { checkPayment } from "@/lib/infinitepay";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/settings";
import { cancelExpiredOrder } from "@/lib/orders";
import { sendNewOrderAlert, sendPaidAfterCancelAlert } from "@/lib/whatsappAlert";

/**
 * Aplica no pedido o status de um pagamento do Mercado Pago. Usado pelo
 * webhook e também pela página do pedido (caso o webhook se perca).
 *
 * As mudanças são "atômicas": só quem muda o pedido de verdade manda o
 * e-mail e o WhatsApp — então avisos repetidos do MP nunca duplicam nada.
 */
export async function applyPayment(payment: PaymentState) {
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
    await applyPayment(await getPaymentState(order.payment_id));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[pagamento] consulta ao Mercado Pago:", order.id, err instanceof Error ? err.message : err);
  }
}

/** Transação da InfinitePay guardada no pedido ("nsu|slug|order_nsu"), se houver. */
export function storedInfinitepayTransaction(paymentId: string | null) {
  const [transactionNsu, slug, orderNsu] = (paymentId ?? "").split("|");
  return transactionNsu && slug ? { transactionNsu, slug, orderNsu: orderNsu || null } : null;
}

/**
 * Confere na InfinitePay uma transação de um pedido (vinda do webhook ou do
 * retorno do cliente) e, se estiver paga com o valor do pedido, marca o pedido
 * como pago. Devolve se o pedido ficou pago.
 *
 * A InfinitePay gera o próprio order_nsu (diferente do id do pedido no site),
 * então a conferência usa o dela. Travas: o valor pago tem que bater com o
 * total do pedido e a mesma transação não pode pagar dois pedidos.
 */
export async function confirmInfinitepayPayment(params: {
  orderId: string;
  transactionNsu: string;
  slug: string;
  orderNsu?: string | null;
}) {
  const db = getSupabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select("id, status, total_cents, payment_provider, payment_status")
    .eq("id", params.orderId)
    .maybeSingle();
  if (!order || order.payment_provider !== "infinitepay") return false;
  if (order.status !== "awaiting_payment" && order.status !== "cancelled") return true; // já pago antes

  // Mesma transação já usada em outro pedido: não paga dois pedidos.
  const { count: reused } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .like("payment_id", `${params.transactionNsu}%`)
    .neq("id", params.orderId);
  if (reused) {
    // eslint-disable-next-line no-console
    console.warn("[infinitepay] transação já usada em outro pedido", params.transactionNsu);
    return false;
  }

  const orderNsu = params.orderNsu || params.orderId;
  // Guarda a transação no pedido: se a conferência falhar agora, a página do
  // pedido (e o webhook) conferem de novo depois.
  await db
    .from("orders")
    .update({ payment_id: `${params.transactionNsu}|${params.slug}|${orderNsu}` })
    .eq("id", params.orderId)
    .in("status", ["awaiting_payment", "cancelled"]);

  let check = await checkPayment({ orderNsu, transactionNsu: params.transactionNsu, slug: params.slug });
  // Sem o order_nsu da InfinitePay (página antiga aberta no navegador), confere
  // só pela transação e pelo slug.
  if (!check.paid && !params.orderNsu) {
    check = await checkPayment({ orderNsu: null, transactionNsu: params.transactionNsu, slug: params.slug });
  }
  // O valor pago tem que bater com o pedido: em centavos (>= total) ou, se vier
  // em reais, igual ao total.
  const [asCents, fromReais] = check.amountCents;
  const amountOk =
    asCents != null && (asCents >= order.total_cents || (fromReais != null && Math.abs(fromReais - order.total_cents) <= 1));
  if (!check.paid || !amountOk) {
    // eslint-disable-next-line no-console
    console.warn("[infinitepay] pagamento não confirmado", params.orderId, JSON.stringify(check));
    return false;
  }

  await applyPayment({ id: params.transactionNsu, status: "approved", external_reference: params.orderId });
  return true;
}

/** Acha o pedido do site de um aviso da InfinitePay (pelo order_nsu ou pela transação já guardada). */
export async function findInfinitepayOrder(orderNsu: string, transactionNsu: string, amountCents?: number | null) {
  const db = getSupabaseAdmin();
  if (/^[0-9a-f-]{36}$/i.test(orderNsu)) {
    const { data } = await db.from("orders").select("id").eq("id", orderNsu).eq("payment_provider", "infinitepay").maybeSingle();
    if (data) return data.id as string;
  }
  const { data } = await db
    .from("orders")
    .select("id")
    .eq("payment_provider", "infinitepay")
    .or(`payment_id.like.${transactionNsu}|%,payment_id.like.%|${orderNsu}`)
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id as string;

  // Cliente pagou e fechou a página sem voltar pro site: a InfinitePay só
  // manda o código dela. Liga pelo valor, entre os pedidos da InfinitePay
  // aguardando pagamento nas últimas 2 h — só se houver exatamente um com
  // esse valor (o pagamento ainda é conferido na InfinitePay depois).
  if (!amountCents || amountCents <= 0) return null;
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: candidates } = await db
    .from("orders")
    .select("id")
    .eq("payment_provider", "infinitepay")
    .in("status", ["awaiting_payment", "cancelled"])
    .eq("total_cents", amountCents)
    .gte("created_at", since)
    .or("payment_id.is.null,payment_id.not.like.%|%")
    .limit(2);
  if (candidates?.length === 1) return candidates[0].id as string;
  // eslint-disable-next-line no-console
  console.warn("[infinitepay webhook] sem pedido único pelo valor", amountCents, candidates?.length ?? 0);
  return null;
}
