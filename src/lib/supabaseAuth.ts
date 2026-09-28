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
