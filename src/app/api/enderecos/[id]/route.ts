import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";

const addressSchema = z.object({
  label: z.string().optional(),
  street: z.string().min(1),
  number: z.string().min(1),
  complement: z.string().optional(),
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  zip: z.string().min(5),
  isDefault: z.boolean().optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados de endereço inválidos" }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  const { data: existing } = await db
    .from("user_addresses")
    .select("id")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Endereço não encontrado" }, { status: 404 });
  }

  if (parsed.data.isDefault) {
    await db.from("user_addresses").update({ is_default: false }).eq("user_id", session.user.id);
  }

  const { data, error } = await db
    .from("user_addresses")
    .update({
      label: parsed.data.label ?? null,
      street: parsed.data.street,
      number: parsed.data.number,
      complement: parsed.data.complement ?? null,
      neighborhood: parsed.data.neighborhood,
      city: parsed.data.city,
      state: parsed.data.state.toUpperCase(),
      zip: parsed.data.zip,
      ...(parsed.data.isDefault ? { is_default: true } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Não foi possível atualizar o endereço." }, { status: 500 });
  }

  return NextResponse.json({ address: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const { error } = await db
    .from("user_addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json({ error: "Não foi possível excluir o endereço." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
