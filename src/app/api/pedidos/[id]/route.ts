import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { releaseAbandonedOrders } from "@/lib/orders";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Pix vencido vira "cancelado" aqui mesmo, sem esperar outra página.
  await releaseAbandonedOrders();

  const db = getSupabaseAdmin();
  const { data: order, error } = await db
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const isOwner =
    order.customer_email === session.user.email.toLowerCase() ||
    (session.user.id != null && order.user_id === session.user.id);
  if (!isOwner && !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  return NextResponse.json({ order });
}
