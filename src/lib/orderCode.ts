/**
 * Número do pedido pro cliente e pro painel: "P3-29-09" = 3º pedido do dia
 * 29/09 (a contagem volta pro P1 à meia-noite, horário de Brasília).
 * Antes da migração do número por dia, mostra o começo do id.
 */
export function orderCode(order: { id: string; day_number?: number | null; order_day?: string | null }) {
  if (order.day_number && order.order_day) {
    const [, month, day] = order.order_day.split("-");
    return `P${order.day_number}-${day}-${month}`;
  }
  return order.id.slice(0, 8).toUpperCase();
}
