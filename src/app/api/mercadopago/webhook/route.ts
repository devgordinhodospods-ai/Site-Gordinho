import { NextResponse } from "next/server";
import { getPayment } from "@/lib/mercadopago";
import { applyPayment } from "@/lib/paymentSync";

/**
 * Webhook do Mercado Pago (a notification_url vai em cada Pix criado:
 * {APP_URL}/api/mercadopago/webhook). Aceita os dois formatos que o MP usa:
 *   ?type=payment&data.id=123   (Webhooks)
 *   ?topic=payment&id=123       (IPN)
 * O pagamento é sempre consultado na API do MP — o corpo da notificação não
 * é confiável por si só.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => null);

  const topic = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body?.type ?? body?.topic;
  const paymentId =
    url.searchParams.get("data.id") ?? body?.data?.id ?? (topic === "payment" ? url.searchParams.get("id") : null);

  if (topic !== "payment" || !paymentId) {
    return NextResponse.json({ received: true });
  }

  try {
    await applyPayment(await getPayment(paymentId));
    return NextResponse.json({ received: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro no webhook do Mercado Pago", err);
    // 500 faz o Mercado Pago tentar de novo mais tarde.
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
