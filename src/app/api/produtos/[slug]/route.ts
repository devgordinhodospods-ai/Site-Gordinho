import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("products")
    .select(
      "id, name, slug, description, price_cents, compare_at_price_cents, images, stock, active, category_id, categories(id, name, slug)"
    )
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ product: data });
}
