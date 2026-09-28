import Image from "next/image";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteSettings } from "@/lib/settings";
import { getActiveCategories } from "@/lib/categories";
import { releaseAbandonedOrders } from "@/lib/orders";
import { HomeCatalog } from "@/components/loja/HomeCatalog";
import { TrustTicker } from "@/components/layout/TrustTicker";
import type { ProductWithFlavors } from "@/lib/types";

async function getActiveProducts(): Promise<ProductWithFlavors[]> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("products")
    .select("*, product_flavors(id, stock)")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(60);
  return data ?? [];
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; categoria?: string }>;
}) {
  const { busca = "", categoria = "" } = await searchParams;
  await releaseAbandonedOrders();
  const [settings, products, categories] = await Promise.all([
    getSiteSettings(),
    getActiveProducts(),
    getActiveCategories(),
  ]);

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

      {/* key: busca/categoria novas pela URL (ex.: busca do topo) recriam o filtro */}
      <HomeCatalog
        key={`${busca}|${categoria}`}
        categories={categories}
        products={products}
        initialQuery={busca}
        initialCategorySlug={categoria}
      />
    </div>
  );
}
