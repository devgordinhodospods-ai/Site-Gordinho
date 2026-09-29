import { NextResponse } from "next/server";
import { getPaymentState } from "@/lib/mercadopago";
import { applyPayment } from "@/lib/paymentSync";

/**
 * Webhook do Mercado Pago: {APP_URL}/api/mercadopago/webhook. Vai em cada Pix
 * da API de Payments; pra API de Orders, cadastre essa URL no painel do MP
 * (Webhooks → evento "Order"). Formatos aceitos:
 *   ?type=payment&data.id=123   (Webhooks)
 *   ?topic=payment&id=123       (IPN)
 *   { type: "order", data: { id: "ORD..." } }
 * O pagamento é sempre consultado na API do MP — o corpo da notificação não
 * é confiável por si só.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => null);

  const topic = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body?.type ?? body?.topic;
  const id = url.searchParams.get("data.id") ?? body?.data?.id ?? url.searchParams.get("id");

  // "payment" = API de Payments · "order" = API de Orders (id começa com ORD)
  if ((topic !== "payment" && topic !== "order") || !id) {
    return NextResponse.json({ received: true });
  }

  try {
    await applyPayment(await getPaymentState(String(id)));
    return NextResponse.json({ received: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro no webhook do Mercado Pago", err);
    // 500 faz o Mercado Pago tentar de novo mais tarde.
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
