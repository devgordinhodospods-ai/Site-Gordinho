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

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("user_addresses")
    .select("*")
    .eq("user_id", session.user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar endereços" }, { status: 500 });
  }

  return NextResponse.json({ addresses: data ?? [] });
}

export async function POST(req: Request) {
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

  const { count } = await db
    .from("user_addresses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.user.id);

  const isFirstAddress = !count || count === 0;
  const shouldBeDefault = parsed.data.isDefault || isFirstAddress;

  if (shouldBeDefault) {
    await db.from("user_addresses").update({ is_default: false }).eq("user_id", session.user.id);
  }

  const { data, error } = await db
    .from("user_addresses")
    .insert({
      user_id: session.user.id,
      label: parsed.data.label ?? null,
      street: parsed.data.street,
      number: parsed.data.number,
      complement: parsed.data.complement ?? null,
      neighborhood: parsed.data.neighborhood,
      city: parsed.data.city,
      state: parsed.data.state.toUpperCase(),
      zip: parsed.data.zip,
      is_default: shouldBeDefault,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar o endereço." }, { status: 500 });
  }

  return NextResponse.json({ address: data });
}
