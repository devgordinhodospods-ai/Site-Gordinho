import Image from "next/image";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteSettings } from "@/lib/settings";
import { getActiveCategories } from "@/lib/categories";
import { ProductCard } from "@/components/loja/ProductCard";
import { CategoryGrid } from "@/components/loja/CategoryGrid";
import { ProductRow } from "@/components/loja/ProductRow";
import { TrustTicker } from "@/components/layout/TrustTicker";
import type { Category, ProductWithFlavors } from "@/lib/types";

async function getFeaturedProducts(): Promise<ProductWithFlavors[]> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("products")
    .select("*, product_flavors(id, stock)")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}

async function getProductsByCategory(categoryId: string): Promise<ProductWithFlavors[]> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("products")
    .select("*, product_flavors(id, stock)")
    .eq("active", true)
    .eq("category_id", categoryId)
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}

export default async function HomePage() {
  const [settings, products, categories] = await Promise.all([
    getSiteSettings(),
    getFeaturedProducts(),
    getActiveCategories(),
  ]);

  const showcaseCategories = categories.slice(0, 3);
  const categoryRows = await Promise.all(
    showcaseCategories.map(async (cat: Category) => ({
      category: cat,
      products: await getProductsByCategory(cat.id),
    }))
  );

  return (
    <div>
      {settings.hero_image_url && (
        <section className="relative h-40 w-full bg-black sm:h-56 md:h-72 lg:h-96">
          <Image
            src={settings.hero_image_url}
            alt={settings.store_name}
            fill
            priority
            className="object-contain"
            sizes="100vw"
          />
        </section>
      )}

      <TrustTicker />

      <CategoryGrid categories={categories} />

      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="font-display mb-4 text-xl text-slate-900">Novidades</h2>
        {products.length === 0 ? (
          <p className="text-slate-500">
            Nenhum produto cadastrado ainda. Acesse o painel administrativo para começar a montar o catálogo.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {categoryRows.map(
        ({ category, products }) =>
          products.length > 0 && (
            <ProductRow
              key={category.id}
              title={category.name}
              products={products}
              seeMoreHref={`/produtos?categoria=${category.slug}`}
            />
          )
      )}
    </div>
  );
}
