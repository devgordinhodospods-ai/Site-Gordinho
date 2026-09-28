import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { computeDynamicShippingFee, computeServiceFee } from "@/lib/shipping";
import { getSiteSettings } from "@/lib/settings";
import { createPaymentPreference } from "@/lib/mercadopago";
import { releaseAbandonedOrders } from "@/lib/orders";

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        flavorId: z.string().uuid().optional(),
      })
    )
    .min(1),
  zoneId: z.string().uuid(),
  address: z.object({
    street: z.string().min(1),
    number: z.string().min(1),
    complement: z.string().optional(),
    neighborhood: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(2),
    zip: z.string().min(5),
  }),
  customerPhone: z.string().refine((v) => v.replace(/\D/g, "").length >= 10, {
    message: "Informe um telefone/WhatsApp com DDD.",
  }),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "É preciso estar logado para finalizar o pedido." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados de checkout inválidos" },
      { status: 400 }
    );
  }

  const { items, zoneId, address, customerPhone } = parsed.data;
  const db = getSupabaseAdmin();

  await releaseAbandonedOrders();

  const { data: zone } = await db
    .from("shipping_zones")
    .select("id, base_fee_cents, km_from_origin")
    .eq("id", zoneId)
    .eq("active", true)
    .maybeSingle();

  if (!zone) {
    return NextResponse.json({ error: "Região de entrega inválida." }, { status: 400 });
  }

  const settings = await getSiteSettings();
  const shippingBreakdown = await computeDynamicShippingFee({
    zone,
    originLat: settings.origin_lat,
    originLng: settings.origin_lng,
  });

  const { data: productsData } = await db
    .from("products")
    .select("id, price_cents")
    .in("id", items.map((i) => i.productId));

  // Soma por linha do carrinho (o mesmo produto pode vir em mais de uma
  // linha, uma por sabor).
  const priceById = new Map((productsData ?? []).map((p) => [p.id, p.price_cents]));
  const subtotalCents = items.reduce((sum, i) => sum + (priceById.get(i.productId) ?? 0) * i.quantity, 0);

  const serviceFeeCents = computeServiceFee({
    subtotalCents,
    percent: settings.service_fee_percent,
    fixedCents: settings.service_fee_fixed,
  });

  const { data: orderId, error: rpcError } = await db.rpc("create_order_with_items", {
    p_customer_name: session.user.name ?? "Cliente",
    p_customer_email: session.user.email,
    p_customer_phone: customerPhone,
    p_user_id: session.user.id ?? null,
    p_shipping_address: address,
    p_shipping_zone_id: zone.id,
    p_shipping_fee_cents: shippingBreakdown.totalCents,
    p_service_fee_cents: serviceFeeCents,
    p_shipping_breakdown: shippingBreakdown,
    p_items: items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      flavor_id: i.flavorId ?? null,
    })),
  });

  if (rpcError || !orderId) {
    return NextResponse.json(
      { error: rpcError?.message ?? "Não foi possível criar o pedido." },
      { status: 400 }
    );
  }

  const { data: order } = await db.from("orders").select("*").eq("id", orderId).single();
  const { data: orderItems } = await db.from("order_items").select("*").eq("order_id", orderId);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  try {
    const preference = await createPaymentPreference({
      orderId,
      items: (orderItems ?? []).map((i) => ({
        title: i.flavor_name ? `${i.product_name} (${i.flavor_name})` : i.product_name,
        quantity: i.quantity,
        unitPriceCents: i.unit_price_cents,
      })),
      serviceFeeCents: order?.service_fee_cents ?? 0,
      payerEmail: session.user.email,
      successUrl: `${appUrl}/pedidos/${orderId}?status=success`,
      failureUrl: `${appUrl}/pedidos/${orderId}?status=failure`,
      pendingUrl: `${appUrl}/pedidos/${orderId}?status=pending`,
      notificationUrl: `${appUrl}/api/mercadopago/webhook`,
    });

    await db
      .from("orders")
      .update({ payment_id: preference.id, payment_status: "pending" })
      .eq("id", orderId);

    return NextResponse.json({ orderId, initPoint: preference.init_point });
  } catch (err) {
    // Sem link de pagamento o pedido não tem como ser pago: cancela e
    // devolve o estoque, pro cliente poder tentar de novo sem duplicar.
    await db.rpc("cancel_order", { p_order_id: orderId });
    // eslint-disable-next-line no-console
    console.error("[create-order] Mercado Pago:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Não foi possível gerar o pagamento agora. Tente novamente em instantes." },
      { status: 502 }
    );
  }
}
