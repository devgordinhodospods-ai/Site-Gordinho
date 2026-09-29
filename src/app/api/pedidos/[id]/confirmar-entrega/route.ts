import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { sendDeliveryConfirmedAlert } from "@/lib/whatsappAlert";

/** O cliente confirma que recebeu o pedido (só quando ele já saiu pra entrega). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  const isOwner =
    order &&
    (order.customer_email === session.user.email.toLowerCase() ||
      (session.user.id != null && order.user_id === session.user.id));
  if (!order || !isOwner) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  // Só um clique vale (mesmo com dois toques seguidos): troca "saiu pra entrega" → "entregue".
  const { count } = await db
    .from("orders")
    .update({ status: "delivered", updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .eq("status", "shipped");

  if (!count) {
    if (order.status === "delivered") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "Esse pedido ainda não saiu pra entrega." }, { status: 400 });
  }

  const settings = await getSiteSettings();
  await sendDeliveryConfirmedAlert({ order, settings }).catch(() => null);
  return NextResponse.json({ ok: true });
}
