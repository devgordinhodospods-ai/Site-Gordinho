import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyEmailCode } from "@/lib/supabaseAuth";

const schema = z.object({
  email: z.string().trim().email(),
  code: z.string().regex(/^\d{6,10}$/, "Digite o código que chegou no seu e-mail."),
});

/** 2ª etapa do cadastro: confere o código no Supabase e só então cria a conta. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const db = getSupabaseAdmin();

  const { data: pending } = await db.from("pending_signups").select("*").eq("email", email).maybeSingle();
  if (!pending) {
    return NextResponse.json({ error: "Cadastro não encontrado. Comece de novo." }, { status: 404 });
  }

  if (!(await verifyEmailCode(email, parsed.data.code))) {
    return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 400 });
  }

  const { error: insertError } = await db.from("site_users").insert({
    name: pending.name,
    email,
    phone: pending.phone,
    password_hash: pending.password_hash,
    auth_provider: "credentials",
  });
  // 23505 = e-mail já cadastrado (ex.: confirmou duas vezes) — segue normal.
  if (insertError && insertError.code !== "23505") {
    // eslint-disable-next-line no-console
    console.error("[cadastro/confirmar]", insertError.message);
    return NextResponse.json({ error: "Não foi possível criar a conta." }, { status: 500 });
  }

  await db.from("pending_signups").delete().eq("email", email);
  return NextResponse.json({ ok: true });
}
