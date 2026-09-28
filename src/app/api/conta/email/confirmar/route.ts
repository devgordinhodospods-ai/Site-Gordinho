import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";

const schema = z.object({ code: z.string().min(6).max(6) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const currentEmail = session.user.email.toLowerCase();

  const { data: user } = await db
    .from("site_users")
    .select("pending_email, email_change_code, email_change_expires_at")
    .eq("email", currentEmail)
    .maybeSingle();

  if (!user || !user.pending_email || !user.email_change_code) {
    return NextResponse.json({ error: "Nenhuma troca de e-mail pendente." }, { status: 400 });
  }

  if (user.email_change_expires_at && new Date(user.email_change_expires_at) < new Date()) {
    return NextResponse.json({ error: "Código expirado. Solicite um novo." }, { status: 400 });
  }

  if (user.email_change_code !== parsed.data.code) {
    return NextResponse.json({ error: "Código incorreto." }, { status: 400 });
  }

  const { error } = await db
    .from("site_users")
    .update({
      email: user.pending_email,
      pending_email: null,
      email_change_code: null,
      email_change_expires_at: null,
    })
    .eq("email", currentEmail);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[conta/email/confirmar]", error.message);
    return NextResponse.json(
      { error: getErrorMessage(error, "Não foi possível trocar o e-mail.") },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, newEmail: user.pending_email });
}
