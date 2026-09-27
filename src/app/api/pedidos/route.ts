import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("orders")
    .select("*, order_items(*)")
    .eq("customer_email", session.user.email)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar pedidos" }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [] });
}
