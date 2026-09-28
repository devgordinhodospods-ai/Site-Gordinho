import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseAuthClient } from "@/lib/supabaseAuth";

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

  const { error: otpError } = await getSupabaseAuthClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (otpError) {
    // eslint-disable-next-line no-console
    console.error("[cadastro] envio do código:", otpError.status, otpError.message);
    const rateLimited = otpError.status === 429 || /rate limit|seconds/i.test(otpError.message);
    return NextResponse.json(
      {
        error: rateLimited
          ? "Muitos pedidos de código seguidos. Espere um minuto e tente de novo."
          : "Não foi possível enviar o código de verificação agora. Tente novamente em instantes.",
      },
      { status: rateLimited ? 429 : 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
