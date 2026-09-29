import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { releaseAbandonedOrders } from "@/lib/orders";
import { syncOrderPayment } from "@/lib/paymentSync";

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

  // Pix ainda "aguardando": confere direto no Mercado Pago (se o aviso do MP
  // se perder, o pedido vira pago mesmo assim, e a loja é avisada).
  if (order.status === "awaiting_payment" && shouldCheck(order.id)) {
    await syncOrderPayment(order);
    const { data: fresh } = await db.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
    return NextResponse.json({ order: fresh ?? order });
  }

  return NextResponse.json({ order });
}

// No máximo uma consulta ao Mercado Pago a cada 15 s por pedido.
const lastCheck = new Map<string, number>();
function shouldCheck(orderId: string) {
  const now = Date.now();
  if (now - (lastCheck.get(orderId) ?? 0) < 15_000) return false;
  lastCheck.set(orderId, now);
  if (lastCheck.size > 500) lastCheck.clear();
  return true;
}
