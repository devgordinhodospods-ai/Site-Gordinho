import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmailCode } from "@/lib/supabaseAuth";

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().email("E-mail inválido."),
  phone: z
    .string()
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Informe um WhatsApp com DDD."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

/**
 * 1ª etapa do cadastro: guarda os dados como pendentes e pede ao Supabase
 * pra mandar um código de verificação pro e-mail. A conta só é criada em
 * /api/cadastro/confirmar, depois do código certo.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const db = getSupabaseAdmin();

  const { data: existing } = await db.from("site_users").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Já existe uma conta com este e-mail. Faça login." }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(parsed.data.password, 10);
  const { error: pendingError } = await db.from("pending_signups").upsert(
    {
      email,
      name: parsed.data.name,
      phone: parsed.data.phone,
      password_hash,
      created_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );
  if (pendingError) {
    // eslint-disable-next-line no-console
    console.error("[cadastro] pending_signups:", pendingError.message);
    return NextResponse.json({ error: "Não foi possível iniciar o cadastro." }, { status: 500 });
  }

  const sent = await sendEmailCode(email);
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status });

  return NextResponse.json({ ok: true });
}
