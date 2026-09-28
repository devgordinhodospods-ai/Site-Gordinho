import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { sendEmailChangeCode } from "@/lib/email";
import { getErrorMessage } from "@/lib/errors";

const schema = z.object({ newEmail: z.string().email() });

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

  const { data: existing } = await db
    .from("site_users")
    .select("id")
    .eq("email", newEmail)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Já existe uma conta com esse e-mail." }, { status: 409 });
  }

  const { data: currentUser } = await db
    .from("site_users")
    .select("name")
    .eq("email", currentEmail)
    .maybeSingle();

  if (!currentUser) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await db
    .from("site_users")
    .update({ pending_email: newEmail, email_change_code: code, email_change_expires_at: expiresAt })
    .eq("email", currentEmail);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[conta/email/solicitar]", error.message);
    return NextResponse.json(
      { error: getErrorMessage(error, "Não foi possível iniciar a troca de e-mail.") },
      { status: 500 }
    );
  }

  const settings = await getSiteSettings();
  await sendEmailChangeCode({ toEmail: newEmail, customerName: currentUser.name, code, settings });

  return NextResponse.json({ ok: true });
}
