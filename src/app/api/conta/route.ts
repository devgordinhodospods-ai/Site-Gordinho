import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("site_users")
    .select("name, email, phone, auth_provider")
    .eq("email", session.user.email.toLowerCase())
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
});

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { error } = await db
    .from("site_users")
    .update({ name: parsed.data.name, phone: parsed.data.phone ?? null })
    .eq("email", session.user.email.toLowerCase());

  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
