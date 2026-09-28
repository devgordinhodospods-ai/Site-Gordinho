import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Tempo que o cliente tem pra pagar depois de gerar o link de pagamento. */
export const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Cancela (devolvendo o estoque) pedidos que passaram da validade do link de
 * pagamento sem serem pagos. Chamado nas páginas da loja, no checkout e no
 * painel — assim estoque de pedido abandonado nunca fica preso.
 */
export async function releaseAbandonedOrders() {
  try {
    const db = getSupabaseAdmin();
    const cutoff = new Date(Date.now() - PAYMENT_WINDOW_MS - 15 * 60 * 1000).toISOString();
    const { data: stale } = await db
      .from("orders")
      .select("id")
      .eq("status", "awaiting_payment")
      .lt("created_at", cutoff)
      .limit(50);
    for (const order of stale ?? []) {
      await db.rpc("cancel_order", { p_order_id: order.id });
    }
  } catch {
    // limpeza é "melhor esforço": nunca deve derrubar a página
  }
}
