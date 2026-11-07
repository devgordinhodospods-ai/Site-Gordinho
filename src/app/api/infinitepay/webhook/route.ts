import { NextResponse } from "next/server";
import { confirmInfinitepayPayment, findInfinitepayOrder } from "@/lib/paymentSync";

/**
 * Aviso de pagamento da InfinitePay. O aviso não vem assinado, então nada é
 * aceito só por ele: a transação é conferida na InfinitePay antes de marcar
 * o pedido como pago. Responder 400 faz a InfinitePay tentar de novo.
 */
export async function POST(req: Request) {
  const raw = await req.text().catch(() => "");
  // eslint-disable-next-line no-console
  console.log("[infinitepay webhook] recebido", raw.slice(0, 600));
  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = Object.fromEntries(new URLSearchParams(raw));
  }

  const orderNsu = String(body?.order_nsu ?? "");
  const transactionNsu = String(body?.transaction_nsu ?? "");
  const slug = String(body?.invoice_slug ?? body?.slug ?? "");
  if (!orderNsu || !transactionNsu || !slug) {
    return NextResponse.json({ error: "Aviso incompleto." }, { status: 400 });
  }

  // O order_nsu é o da InfinitePay: acha o pedido do site por ele ou pela
  // transação (guardada quando o cliente volta pro site).
  const orderId = await findInfinitepayOrder(orderNsu, transactionNsu);
  if (!orderId) {
    // eslint-disable-next-line no-console
    console.warn("[infinitepay webhook] pedido não encontrado ainda", orderNsu, transactionNsu);
    // 400 faz a InfinitePay tentar de novo (até lá o retorno do cliente liga a transação ao pedido).
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 400 });
  }

  try {
    const paid = await confirmInfinitepayPayment({ orderId, transactionNsu, slug, orderNsu });
    if (!paid) return NextResponse.json({ error: "Pagamento não confirmado." }, { status: 400 });
    return NextResponse.json({ received: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[infinitepay webhook]", orderId, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Falha ao conferir o pagamento." }, { status: 400 });
  }
}
