import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { verifyEmailCode } from "@/lib/supabaseAuth";

const schema = z.object({
  code: z.string().regex(/^\d{6,10}$/, "Digite o código que chegou no seu e-mail."),
  password: z.string().min(6, "A nova senha precisa ter pelo menos 6 caracteres."),
});

/** Troca de senha, 2ª etapa: confere o código no Supabase e grava a senha nova. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const email = session.user.email.toLowerCase();
  if (!(await verifyEmailCode(email, parsed.data.code))) {
    return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(parsed.data.password, 10);
  const { data: updated, error } = await getSupabaseAdmin()
    .from("site_users")
    .update({ password_hash })
    .eq("email", email)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    // eslint-disable-next-line no-console
    console.error("[conta/senha/confirmar]", error?.message);
    return NextResponse.json({ error: "Não foi possível trocar a senha." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
