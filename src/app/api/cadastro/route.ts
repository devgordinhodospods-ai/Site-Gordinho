import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, phone, password } = parsed.data;
  const db = getSupabaseAdmin();

  const { data: existing } = await db
    .from("site_users")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { error } = await db.from("site_users").insert({
    name,
    email: email.toLowerCase(),
    phone: phone ?? null,
    password_hash,
    auth_provider: "credentials",
  });

  if (error) {
    return NextResponse.json({ error: "Não foi possível criar a conta." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
