import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { computeServiceFee } from "@/lib/money";
import { estimateFreight } from "@/lib/geo";
import { getSiteSettings } from "@/lib/settings";
import { createPixPayment, describeMercadoPagoError } from "@/lib/mercadopago";
import { PAYMENT_WINDOW_MS, releaseAbandonedOrders } from "@/lib/orders";
import { sendPixPendingEmail } from "@/lib/email";

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

  const { items, address, customerPhone } = parsed.data;
  const db = getSupabaseAdmin();

  await releaseAbandonedOrders();

  const settings = await getSiteSettings();

  // Frete estimado pela distância (pago ao entregador, não entra no total).
  // Calculado aqui no servidor pra não confiar no valor vindo do navegador.
  const freight = await estimateFreight(address.zip, settings);
  if (freight.status === "out_of_range") {
    return NextResponse.json(
      { error: `Ainda não entregamos nesse endereço (${freight.km} km da loja; atendemos até ${freight.maxKm} km).` },
      { status: 400 }
    );
  }

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
    p_shipping_zone_id: null,
    p_shipping_fee_cents: freight.status === "ok" ? freight.feeCents : 0,
    p_service_fee_cents: serviceFeeCents,
    p_shipping_breakdown: freight.status === "ok" ? { km: freight.km, city: freight.city } : null,
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

  const { data: createdOrder } = await db.from("orders").select("*").eq("id", orderId).single();
  const { data: orderItems } = await db.from("order_items").select("*").eq("order_id", orderId);

  // O total cobrado no site é produtos + taxa de serviço; o frete é pago ao
  // entregador. Garante isso mesmo se a função do banco for de uma versão
  // antiga que somava o frete.
  let order = createdOrder;
  if (order && order.total_cents !== order.subtotal_cents + order.service_fee_cents) {
    const { data: fixed } = await db
      .from("orders")
      .update({ total_cents: order.subtotal_cents + order.service_fee_cents })
      .eq("id", orderId)
      .select("*")
      .single();
    order = fixed ?? { ...order, total_cents: order.subtotal_cents + order.service_fee_cents };
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MS);
  const notificationUrl = `${appUrl}/api/mercadopago/webhook`;

  let payment: { id: string; qrCode: string | null; url: string | null; status: string };
  try {
    // Pix direto: QR code e copia e cola aparecem no próprio pedido.
    const { data: customer } = await db
      .from("site_users")
      .select("name, cpf")
      .eq("email", session.user.email.toLowerCase())
      .maybeSingle();
    const [firstName, ...rest] = (customer?.name ?? session.user.name ?? "Cliente").trim().split(/\s+/);
    const pix = await createPixPayment({
      orderId,
      amountCents: order?.total_cents ?? 0,
      description: `Pedido #${orderId.slice(0, 8).toUpperCase()} - ${settings.store_name}`,
      payer: { email: session.user.email, firstName, lastName: rest.join(" ") || undefined, cpf: customer?.cpf },
      notificationUrl,
      expiresAt,
    });
    payment = { id: pix.id, qrCode: pix.qrCode, url: pix.ticketUrl, status: "pending" };
  } catch (pixErr) {
    // A loja recebe só por Pix: sem QR code não tem como pagar. Cancela
    // (devolve o estoque) e mostra o motivo que o Mercado Pago deu.
    await db.rpc("cancel_order", { p_order_id: orderId });
    const reason = describeMercadoPagoError(pixErr);
    // eslint-disable-next-line no-console
    console.error("[create-order] Pix:", reason.detail);
    return NextResponse.json({ error: reason.message }, { status: 502 });
  }

  const { data: updated } = await db
    .from("orders")
    .update({
      payment_id: payment.id,
      payment_status: payment.status,
      pix_qr_code: payment.qrCode,
      payment_url: payment.url,
      payment_expires_at: expiresAt.toISOString(),
    })
    .eq("id", orderId)
    .select("*")
    .single();

  if (updated) {
    await sendPixPendingEmail({ order: updated, items: orderItems ?? [], settings });
  }

  return NextResponse.json({ orderId });
}
