import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { releaseAbandonedOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Cron diário da Vercel (vercel.json). O Supabase grátis pausa o projeto
 * depois de 7 dias sem uso — esta rota usa o banco todo dia pra ele nunca
 * pausar, e aproveita pra fazer uma limpeza leve.
 */
export async function GET(req: Request) {
  // A Vercel manda "Authorization: Bearer <CRON_SECRET>" quando a variável existe.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const startedAt = Date.now();

  // 1) Leitura simples: já conta como atividade no Supabase.
  const { count: products, error } = await db.from("products").select("id", { count: "exact", head: true });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[cron keep-alive]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // 2) Limpeza: Pix vencidos que ninguém abriu e cadastros nunca confirmados (> 2 dias).
  await releaseAbandonedOrders();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  await db.from("pending_signups").delete().lt("created_at", twoDaysAgo);

  return NextResponse.json({ ok: true, products, ms: Date.now() - startedAt, at: new Date().toISOString() });
}
