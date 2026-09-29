import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPayment } from "@/lib/mercadopago";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/settings";
import { cancelExpiredOrder } from "@/lib/orders";

/**
 * Webhook do Mercado Pago. Configurar a notification_url do Checkout Pro
 * para {APP_URL}/api/mercadopago/webhook.
 * Doc: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/notifications/webhooks
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => null);

  const paymentId =
    url.searchParams.get("data.id") ??
    body?.data?.id ??
    (body?.type === "payment" ? body?.data?.id : null);

  const topic = url.searchParams.get("topic") ?? body?.type;

  if (topic !== "payment" || !paymentId) {
    return NextResponse.json({ received: true });
  }

  try {
    const payment = await getPayment(paymentId);
    const orderId = payment.external_reference;
    if (!orderId) return NextResponse.json({ received: true });

    const db = getSupabaseAdmin();
    const { data: order } = await db.from("orders").select("*").eq("id", orderId).single();
    if (!order) return NextResponse.json({ received: true });

    let newStatus = order.status;
    if (payment.status === "approved" && order.status === "awaiting_payment") {
      newStatus = "paid";
    }

    // Só "cancelled" encerra o pedido (ex.: Pix/boleto expirado). "rejected"
    // não: no Checkout Pro o cliente pode tentar de novo com outro cartão, e
    // cancelar aqui faria um pagamento aprovado depois cair num pedido já
    // cancelado e com o estoque devolvido.
    const shouldReleaseStock = payment.status === "cancelled" && order.status === "awaiting_payment";

    if (payment.status === "approved" && order.status === "cancelled") {
      // eslint-disable-next-line no-console
      console.error(`[webhook] Pagamento aprovado para pedido já cancelado: ${orderId}`);
    }

    if (shouldReleaseStock) {
      // Pix vencido no Mercado Pago: cancela, devolve o estoque e avisa o cliente.
      await cancelExpiredOrder(orderId);
      newStatus = "cancelled";
    }

    await db
      .from("orders")
      .update({
        payment_id: String(payment.id),
        payment_status: payment.status,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (newStatus === "paid" && order.status !== "paid") {
      const { data: items } = await db.from("order_items").select("*").eq("order_id", orderId);
      const settings = await getSiteSettings();
      await sendOrderConfirmationEmail({
        order: { ...order, status: "paid" },
        items: items ?? [],
        settings,
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro no webhook do Mercado Pago", err);
    return NextResponse.json({ received: true });
  }
}
