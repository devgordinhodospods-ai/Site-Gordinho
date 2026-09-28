import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { sendEmailCode } from "@/lib/supabaseAuth";
import { getErrorMessage } from "@/lib/errors";

const schema = z.object({ newEmail: z.string().email() });

/** Troca de e-mail, 1ª etapa: o Supabase manda um código pro e-mail novo. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  }

  const newEmail = parsed.data.newEmail.toLowerCase().trim();
  const currentEmail = session.user.email.toLowerCase();

  if (newEmail === currentEmail) {
    return NextResponse.json({ error: "Esse já é o seu e-mail atual." }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  const { data: existing } = await db.from("site_users").select("id").eq("email", newEmail).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Já existe uma conta com esse e-mail." }, { status: 409 });
  }

  const { data: updated, error } = await db
    .from("site_users")
    .update({ pending_email: newEmail, email_change_code: null, email_change_expires_at: null })
    .eq("email", currentEmail)
    .select("id")
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[conta/email/solicitar]", error.message);
    return NextResponse.json(
      { error: getErrorMessage(error, "Não foi possível iniciar a troca de e-mail.") },
      { status: 500 }
    );
  }
  if (!updated) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const sent = await sendEmailCode(newEmail);
  if (!sent.ok) {
    await db.from("site_users").update({ pending_email: null }).eq("email", currentEmail);
    return NextResponse.json({ error: sent.error }, { status: sent.status });
  }

  return NextResponse.json({ ok: true });
}
