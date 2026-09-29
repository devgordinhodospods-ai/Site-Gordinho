import Image from "next/image";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteSettings, heroImages } from "@/lib/settings";
import { getActiveCategories } from "@/lib/categories";
import { releaseAbandonedOrders } from "@/lib/orders";
import { HomeCatalog } from "@/components/loja/HomeCatalog";
import { TrustTicker } from "@/components/layout/TrustTicker";
import { HeroCarousel } from "@/components/loja/HeroCarousel";
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
      <HeroCarousel images={heroImages(settings)} alt={settings.store_name} />

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
