import { createClient } from "@supabase/supabase-js";

/**
 * Cliente do Supabase Auth usado só pra enviar e conferir o código de
 * verificação de e-mail no cadastro. O login do site continua sendo o do
 * NextAuth — a sessão que o Supabase devolve aqui é descartada.
 */
export function getSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não configurados.");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Pede ao Supabase pra mandar um código de verificação pro e-mail (usa o
 * SMTP e os modelos "Confirm signup"/"Magic Link" configurados lá).
 */
export async function sendEmailCode(email: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { error } = await getSupabaseAuthClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (!error) return { ok: true };

  // eslint-disable-next-line no-console
  console.error("[sendEmailCode]", error.status, error.message);
  const msg = error.message ?? "";
  if (error.status === 429 || /rate limit|seconds/i.test(msg)) {
    return { ok: false, status: 429, error: "Muitos pedidos de código seguidos. Espere um minuto e tente de novo." };
  }
  if (/signups? not allowed|signup.*disabled/i.test(msg)) {
    return { ok: false, status: 502, error: "Cadastro por e-mail desativado no Supabase (Allow new users to sign up)." };
  }
  if (/error sending|smtp|email/i.test(msg)) {
    return {
      ok: false,
      status: 502,
      error: `O e-mail com o código não pôde ser enviado (servidor de e-mail recusou: ${msg}). Tente de novo em instantes.`,
    };
  }
  return { ok: false, status: 502, error: `Não foi possível enviar o código agora (${msg || "erro desconhecido"}).` };
}

/** Confere o código que o cliente digitou. */
export async function verifyEmailCode(email: string, code: string) {
  const { error } = await getSupabaseAuthClient().auth.verifyOtp({ email, token: code, type: "email" });
  return !error;
}
