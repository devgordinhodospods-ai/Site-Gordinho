import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("categoria");
  const search = searchParams.get("busca");

  const db = getSupabaseAdmin();
  let query = db
    .from("products")
    .select(
      "id, name, slug, description, price_cents, compare_at_price_cents, images, stock, category_id, active, product_flavors(id, stock)"
    )
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (category) {
    const { data: cat } = await db.from("categories").select("id").eq("slug", category).maybeSingle();
    if (cat) query = query.eq("category_id", cat.id);
  }

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar produtos" }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}
