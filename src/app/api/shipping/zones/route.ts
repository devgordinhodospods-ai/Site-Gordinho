import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("shipping_zones")
    .select("id, name, cities, neighborhoods")
    .eq("active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar regiões de entrega" }, { status: 500 });
  }

  return NextResponse.json({ zones: data ?? [] });
}
