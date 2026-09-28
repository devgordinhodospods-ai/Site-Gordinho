import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
      await db.rpc("cancel_order", { p_order_id: order.id });
    }
  } catch {
    // limpeza é "melhor esforço": nunca deve derrubar a página
  }
}
