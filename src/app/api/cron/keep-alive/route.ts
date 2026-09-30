import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { releaseAbandonedOrders } from "@/lib/orders";
import { getWhatsappStatus, whatsappAlertConfigured } from "@/lib/whatsappAlert";
import { sendAdminAlertEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Cron diário da Vercel (vercel.json). O Supabase grátis pausa o projeto
 * depois de 7 dias sem uso — esta rota usa o banco todo dia pra ele nunca
 * pausar, e aproveita pra fazer uma limpeza leve.
 */
export async function GET(req: Request) {
  // A Vercel manda "Authorization: Bearer <CRON_SECRET>" quando a variável existe;
  // serviços externos (ex.: cron-job.org) podem mandar ?secret=<CRON_SECRET> no link.
  const secret = process.env.CRON_SECRET;
  const fromQuery = new URL(req.url).searchParams.get("secret");
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}` && fromQuery !== secret) {
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

  // 3) WhatsApp de avisos desconectado: avisa os admins por e-mail pra lerem o QR.
  let whatsapp: string | null = null;
  if (whatsappAlertConfigured()) {
    const wa = await getWhatsappStatus();
    whatsapp = "error" in wa ? "erro" : wa.status;
    if (whatsapp !== "conectado") {
      const settings = await getSiteSettings();
      if (settings.whatsapp_alert_number) {
        const reason =
          "error" in wa ? wa.error : (wa.lastDisconnect?.reason ?? "O WhatsApp está esperando a leitura do QR code.");
        await sendAdminAlertEmail({
          settings,
          subject: "WhatsApp de avisos desconectado",
          title: "O WhatsApp de avisos está desconectado",
          intro: `Enquanto ele estiver desconectado, os avisos de pedido chegam só por e-mail. ${reason} Abra Configurações → Avisos no painel e leia o QR code de novo.`,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, products, whatsapp, ms: Date.now() - startedAt, at: new Date().toISOString() });
}
