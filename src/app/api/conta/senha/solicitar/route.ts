import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { sendEmailCode } from "@/lib/supabaseAuth";

/** Troca de senha, 1ª etapa: o Supabase manda um código pro e-mail da conta. */
export async function POST() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const email = session.user.email.toLowerCase();
  const { data: user } = await getSupabaseAdmin().from("site_users").select("id").eq("email", email).maybeSingle();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const sent = await sendEmailCode(email);
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status });
  return NextResponse.json({ ok: true, email });
}
