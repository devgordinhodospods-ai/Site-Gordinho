import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

type Line = { productId: string; flavorId: string | null };

/**
 * Confere os itens do carrinho (que fica salvo no navegador) com o catálogo
 * atual: produto excluído, oculto, sabor removido ou esgotado sai do
 * carrinho; preço, nome e estoque são atualizados.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.items) ? body.items.slice(0, 60) : [];
  const lines: Line[] = raw
    .map((r) => r as Record<string, unknown>)
    .filter((r) => typeof r.productId === "string" && UUID.test(r.productId))
    .map((r) => ({
      productId: r.productId as string,
      flavorId: typeof r.flavorId === "string" && UUID.test(r.flavorId) ? r.flavorId : null,
    }));
  if (lines.length === 0) return NextResponse.json({ lines: [] });

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("products")
    .select("id, name, slug, price_cents, stock, active, images, product_flavors(id, name, stock, image_url)")
    .in("id", [...new Set(lines.map((l) => l.productId))]);
  if (error) return NextResponse.json({ error: "Não foi possível conferir o carrinho." }, { status: 500 });

  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  return NextResponse.json({
    lines: lines.map((l) => {
      const product = byId.get(l.productId);
      if (!product || !product.active) return { ...l, status: "removed" as const, reason: "indisponivel" };
      const flavors = product.product_flavors ?? [];
      const flavor = l.flavorId ? flavors.find((f) => f.id === l.flavorId) : null;
      // Sabor apagado, ou produto que passou a ter sabores e a linha não tem um.
      if ((l.flavorId && !flavor) || (!l.flavorId && flavors.length > 0)) {
        return { ...l, status: "removed" as const, reason: "indisponivel" };
      }
      const stock = flavor ? flavor.stock : product.stock;
      if (stock <= 0) return { ...l, status: "removed" as const, reason: "esgotado" };
      return {
        ...l,
        status: "ok" as const,
        name: product.name,
        slug: product.slug,
        priceCents: product.price_cents,
        stock,
        flavorName: flavor?.name ?? null,
        image: flavor?.image_url || product.images?.[0] || null,
      };
    }),
  });
}
