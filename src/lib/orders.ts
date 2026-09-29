import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendOrderCancelledEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/settings";

/** Tempo que o cliente tem pra pagar depois de gerar o Pix / link de pagamento. */
export const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

/**
 * Folga depois do prazo antes de cancelar: um Pix pago no último minuto
 * ainda tem tempo de ser confirmado pelo webhook do Mercado Pago.
 */
const CONFIRMATION_GRACE_MS = 3 * 60 * 1000;

/**
 * Cancela (devolvendo o estoque) pedidos que passaram da validade do link de
 * pagamento sem serem pagos. Chamado nas páginas da loja, no checkout e no
 * painel — assim estoque de pedido abandonado nunca fica preso.
 */
export async function releaseAbandonedOrders() {
  try {
    const db = getSupabaseAdmin();
    const now = Date.now();
    const expiredBefore = new Date(now - CONFIRMATION_GRACE_MS).toISOString();
    // Pedidos antigos (sem prazo salvo) usam a data de criação.
    const createdBefore = new Date(now - PAYMENT_WINDOW_MS - CONFIRMATION_GRACE_MS).toISOString();
    const { data: stale } = await db
      .from("orders")
      .select("id")
      .eq("status", "awaiting_payment")
      .or(`payment_expires_at.lt.${expiredBefore},and(payment_expires_at.is.null,created_at.lt.${createdBefore})`)
      .limit(50);
    for (const order of stale ?? []) {
      await cancelExpiredOrder(order.id);
    }
  } catch {
    // limpeza é "melhor esforço": nunca deve derrubar a página
  }
}

/**
 * Cancela um pedido cujo Pix venceu (devolve o estoque) e avisa o cliente
 * por e-mail. Seguro de chamar em paralelo: só quem "marca" o pedido
 * primeiro cancela e manda o e-mail, então o cliente nunca recebe dois.
 */
export async function cancelExpiredOrder(orderId: string) {
  const db = getSupabaseAdmin();
  // Conta as linhas afetadas (o PostgREST não devolve a linha quando o
  // filtro usa a própria coluna alterada).
  const { count } = await db
    .from("orders")
    .update({ payment_status: "expired", updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", orderId)
    .eq("status", "awaiting_payment")
    .or("payment_status.is.null,payment_status.neq.expired");
  if (!count) return false;

  const { error } = await db.rpc("cancel_order", { p_order_id: orderId });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[cancelExpiredOrder]", orderId, error.message);
    return false;
  }

  const [{ data: order }, settings] = await Promise.all([
    db.from("orders").select("*").eq("id", orderId).single(),
    getSiteSettings(),
  ]);
  if (order) await sendOrderCancelledEmail({ order, settings, reason: "expired" });
  return true;
}

/**
 * Cancela o pedido e devolve os itens pro estoque, em qualquer etapa. Usa a
 * função cancel_order do banco; se o banco ainda estiver com a versão antiga
 * (que recusava pedido enviado/entregue), faz a devolução por aqui.
 */
export async function cancelAndRestock(orderId: string) {
  const db = getSupabaseAdmin();
  const { error } = await db.rpc("cancel_order", { p_order_id: orderId });
  if (!error) return;
  if (!/enviado|entregue/i.test(error.message)) throw error;

  // Marca como cancelado primeiro: só quem conseguir essa troca devolve o estoque.
  const { count } = await db
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", orderId)
    .neq("status", "cancelled");
  if (!count) return;

  const { data: items } = await db.from("order_items").select("product_id, flavor_id, quantity").eq("order_id", orderId);
  for (const item of items ?? []) {
    const table = item.flavor_id ? "product_flavors" : item.product_id ? "products" : null;
    const id = item.flavor_id ?? item.product_id;
    if (!table || !id) continue;
    const { data: row } = await db.from(table).select("stock").eq("id", id).maybeSingle();
    if (row) await db.from(table).update({ stock: row.stock + item.quantity }).eq("id", id);
  }
}
