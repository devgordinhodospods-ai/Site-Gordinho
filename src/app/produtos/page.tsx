import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getActiveCategories } from "@/lib/categories";
import { releaseAbandonedOrders } from "@/lib/orders";
import { ProductCard } from "@/components/loja/ProductCard";
import type { ProductWithFlavors } from "@/lib/types";

export const metadata: Metadata = { title: "Catálogo" };

function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function getProducts(categoryId: string | null, search: string): Promise<ProductWithFlavors[]> {
  const db = getSupabaseAdmin();
  let query = db
    .from("products")
    .select("*, product_flavors(id, stock)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (categoryId) query = query.eq("category_id", categoryId);
  if (search) query = query.ilike("name", `%${escapeLike(search)}%`);

  const { data } = await query;
  return data ?? [];
}

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; busca?: string }>;
}) {
  const { categoria, busca } = await searchParams;
  await releaseAbandonedOrders();
  const search = (busca ?? "").trim();
  const categories = await getActiveCategories();
  const selected = categories.find((c) => c.slug === categoria) ?? null;
  const products = await getProducts(selected?.id ?? null, search);

  const hrefFor = (slug: string | null) => {
    const params = new URLSearchParams();
    if (slug) params.set("categoria", slug);
    if (search) params.set("busca", search);
    const qs = params.toString();
    return qs ? `/produtos?${qs}` : "/produtos";
  };

  const chipClass = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
      active
        ? "border-brand bg-brand text-white shadow-brand"
        : "border-blue-100 bg-white text-slate-700 hover:border-brand hover:text-brand"
    }`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-slate-900">{selected ? selected.name : "Catálogo"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {products.length} {products.length === 1 ? "produto" : "produtos"}
        </p>
      </div>

      {search && (
        <Link
          href={selected ? `/produtos?categoria=${selected.slug}` : "/produtos"}
          className="mb-4 inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-sm text-brand"
        >
          Busca: &ldquo;{search}&rdquo; <X size={14} />
        </Link>
      )}

      {categories.length > 0 && (
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link href={hrefFor(null)} className={chipClass(!selected)}>
            Todos
          </Link>
          {categories.map((cat) => (
            <Link key={cat.id} href={hrefFor(cat.slug)} className={chipClass(selected?.id === cat.id)}>
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-600">Nenhum produto encontrado.</p>
          {(search || selected) && (
            <Link href="/produtos" className="btn-secondary mt-4">
              Ver todos os produtos
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
