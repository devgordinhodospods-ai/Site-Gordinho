import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { centsToBRL } from "@/lib/money";
import { releaseAbandonedOrders } from "@/lib/orders";
import { AddToCartButton } from "@/components/loja/AddToCartButton";
import { DeliveryInfoCard } from "@/components/loja/DeliveryInfoCard";
import { ProductGallery } from "@/components/loja/ProductGallery";
import type { Category, ProductWithFullFlavors } from "@/lib/types";

type ProductPageData = ProductWithFullFlavors & {
  categories: Pick<Category, "name" | "slug"> | null;
};

async function getProduct(slug: string): Promise<ProductPageData | null> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("products")
    .select("*, categories(name, slug), product_flavors(id, product_id, name, stock, image_url, position)")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  return product ? { title: product.name, description: product.description ?? undefined } : {};
}

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await releaseAbandonedOrders();
  const product = await getProduct(slug);
  if (!product) notFound();

  const flavors = (product.product_flavors ?? []).slice().sort((a, b) => a.position - b.position);
  const images = [
    ...(product.images ?? []),
    ...flavors.map((f) => f.image_url).filter((url): url is string => Boolean(url)),
  ];
  const totalStock = flavors.length > 0 ? flavors.reduce((sum, f) => sum + f.stock, 0) : product.stock;
  const hasDiscount =
    product.compare_at_price_cents != null && product.compare_at_price_cents > product.price_cents;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price_cents / (product.compare_at_price_cents as number)) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-slate-400">
        <Link href="/" className="hover:text-brand">
          Início
        </Link>
        <ChevronRight size={14} />
        {product.categories ? (
          <Link href={`/produtos?categoria=${product.categories.slug}`} className="hover:text-brand">
            {product.categories.name}
          </Link>
        ) : (
          <Link href="/produtos" className="hover:text-brand">
            Catálogo
          </Link>
        )}
        <ChevronRight size={14} />
        <span className="truncate text-slate-600">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <ProductGallery images={images} name={product.name} />

        <div>
          <h1 className="font-display text-2xl text-slate-900 sm:text-3xl">{product.name}</h1>

          <div className="mt-3">
            {hasDiscount && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 line-through">
                  {centsToBRL(product.compare_at_price_cents as number)}
                </span>
                <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs text-white">-{discountPercent}%</span>
              </div>
            )}
            <p className="font-display text-3xl text-brand">{centsToBRL(product.price_cents)}</p>
          </div>

          {flavors.length === 0 && (
            <p className={`mt-2 text-sm ${totalStock > 0 ? "text-green-700" : "text-red-600"}`}>
              {totalStock > 0 ? `${totalStock} em estoque` : "Sem estoque no momento"}
            </p>
          )}

          <div className="mt-6">
            <AddToCartButton product={product} flavors={flavors} />
          </div>

          {product.description && (
            <div className="mt-8 border-t border-blue-50 pt-6">
              <h2 className="font-display mb-2 text-lg text-slate-900">Descrição</h2>
              <p className="whitespace-pre-line text-slate-600">{product.description}</p>
            </div>
          )}

          <div className="mt-8">
            <DeliveryInfoCard />
          </div>
        </div>
      </div>
    </div>
  );
}
