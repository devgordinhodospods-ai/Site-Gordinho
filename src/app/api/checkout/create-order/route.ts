import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { computeDynamicShippingFee, computeServiceFee } from "@/lib/shipping";
import { getSiteSettings } from "@/lib/settings";
import { createPaymentPreference } from "@/lib/mercadopago";

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
  customerPhone: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "É preciso estar logado para finalizar o pedido." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados de checkout inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { items, zoneId, address, customerPhone } = parsed.data;
  const db = getSupabaseAdmin();

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

  const subtotalCents = (productsData ?? []).reduce((sum, p) => {
    const item = items.find((i) => i.productId === p.id);
    return sum + p.price_cents * (item?.quantity ?? 0);
  }, 0);

  const serviceFeeCents = computeServiceFee({
    subtotalCents,
    percent: settings.service_fee_percent,
    fixedCents: settings.service_fee_fixed,
  });

  const { data: orderId, error: rpcError } = await db.rpc("create_order_with_items", {
    p_customer_name: session.user.name ?? "Cliente",
    p_customer_email: session.user.email,
    p_customer_phone: customerPhone ?? null,
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
      shippingFeeCents: order?.shipping_fee_cents ?? 0,
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
    return NextResponse.json(
      {
        orderId,
        error:
          "Pedido criado, mas houve um erro ao gerar o link de pagamento do Mercado Pago. Verifique as credenciais.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
