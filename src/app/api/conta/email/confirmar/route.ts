import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { verifyEmailCode } from "@/lib/supabaseAuth";
import { getErrorMessage } from "@/lib/errors";

const schema = z.object({ code: z.string().regex(/^\d{6,10}$/) });

/** Troca de e-mail, 2ª etapa: confere o código no Supabase e troca o e-mail da conta. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Digite o código que chegou no e-mail novo." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const currentEmail = session.user.email.toLowerCase();

  const { data: user } = await db
    .from("site_users")
    .select("pending_email")
    .eq("email", currentEmail)
    .maybeSingle();

  if (!user?.pending_email) {
    return NextResponse.json({ error: "Nenhuma troca de e-mail pendente." }, { status: 400 });
  }

  if (!(await verifyEmailCode(user.pending_email, parsed.data.code))) {
    return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 400 });
  }

  const { error } = await db
    .from("site_users")
    .update({ email: user.pending_email, pending_email: null })
    .eq("email", currentEmail);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[conta/email/confirmar]", error.message);
    return NextResponse.json(
      { error: getErrorMessage(error, "Não foi possível trocar o e-mail.") },
      { status: 500 }
    );
  }

  // Pedidos antigos passam pro e-mail novo (avisos de status chegam no e-mail certo).
  await db.from("orders").update({ customer_email: user.pending_email }).eq("customer_email", currentEmail);

  return NextResponse.json({ ok: true, newEmail: user.pending_email });
}
