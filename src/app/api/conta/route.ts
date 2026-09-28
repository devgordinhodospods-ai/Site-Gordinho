import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { isValidCPF } from "@/lib/cpf";
import { getErrorMessage } from "@/lib/errors";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("site_users")
    .select("name, email, phone, cpf, auth_provider")
    .eq("email", session.user.email.toLowerCase())
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[conta:GET]", error.message);
    return NextResponse.json(
      { error: getErrorMessage(error, "Erro ao buscar seus dados.") },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  cpf: z
    .string()
    .optional()
    .refine((v) => !v || isValidCPF(v), { message: "CPF inválido" }),
});

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const db = getSupabaseAdmin();
  const { error } = await db
    .from("site_users")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      cpf: parsed.data.cpf ? parsed.data.cpf.replace(/\D/g, "") : null,
    })
    .eq("email", session.user.email.toLowerCase());

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[conta:PUT]", error.message);
    return NextResponse.json(
      { error: getErrorMessage(error, "Não foi possível salvar.") },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
