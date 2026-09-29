import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { releaseAbandonedOrders } from "@/lib/orders";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  await releaseAbandonedOrders();

  const db = getSupabaseAdmin();
  const email = session.user.email.toLowerCase();
  // Pela conta (user_id) ou pelo e-mail — assim nada some se o cliente trocar de e-mail.
  // Valores entre aspas: o filtro do PostgREST não quebra com caracteres especiais.
  const byEmail = `customer_email.eq."${email.replace(/"/g, "")}"`;
  const owner = session.user.id ? `user_id.eq.${session.user.id},${byEmail}` : byEmail;
  const { data, error } = await db
    .from("orders")
    .select("*, order_items(*)")
    .or(owner)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar pedidos" }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [] });
}
