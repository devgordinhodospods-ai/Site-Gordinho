import { NextResponse } from "next/server";
import { confirmInfinitepayPayment } from "@/lib/paymentSync";

/**
 * Aviso de pagamento da InfinitePay. O aviso não vem assinado, então nada é
 * aceito só por ele: a transação é conferida na InfinitePay antes de marcar
 * o pedido como pago. Responder 400 faz a InfinitePay tentar de novo.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const orderId = String(body?.order_nsu ?? "");
  const transactionNsu = String(body?.transaction_nsu ?? "");
  const slug = String(body?.invoice_slug ?? body?.slug ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !transactionNsu || !slug) {
    return NextResponse.json({ error: "Aviso incompleto." }, { status: 400 });
  }

  try {
    const paid = await confirmInfinitepayPayment({ orderId, transactionNsu, slug });
    if (!paid) return NextResponse.json({ error: "Pagamento não confirmado." }, { status: 400 });
    return NextResponse.json({ received: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[infinitepay webhook]", orderId, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Falha ao conferir o pagamento." }, { status: 400 });
  }
}
