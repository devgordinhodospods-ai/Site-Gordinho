import Image from "next/image";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { centsToBRL } from "@/lib/money";
import { AddToCartButton } from "@/components/loja/AddToCartButton";
import { DeliveryEstimateCard } from "@/components/loja/DeliveryEstimateCard";
import type { ProductWithFullFlavors } from "@/lib/types";

async function getProduct(slug: string): Promise<ProductWithFullFlavors | null> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("products")
    .select("*, product_flavors(id, product_id, name, stock, image_url, position)")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return data;
}

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const image = product.images?.[0];
  const flavors = (product.product_flavors ?? []).slice().sort((a, b) => a.position - b.position);
  const totalStock = flavors.length > 0 ? flavors.reduce((sum, f) => sum + f.stock, 0) : product.stock;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
          {image ? (
            <Image src={image} alt={product.name} fill className="object-cover" sizes="50vw" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">Sem imagem</div>
          )}
        </div>

        <div>
          <h1 className="font-display text-2xl text-slate-900">{product.name}</h1>
          <p className="font-display mt-2 text-2xl text-brand">{centsToBRL(product.price_cents)}</p>
          {product.description && (
            <p className="mt-4 whitespace-pre-line text-slate-600">{product.description}</p>
          )}
          {flavors.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">
              {totalStock > 0 ? `${totalStock} em estoque` : "Sem estoque no momento"}
            </p>
          )}

          <div className="mt-6">
            <AddToCartButton product={product} flavors={flavors} />
          </div>

          <div className="mt-6">
            <DeliveryEstimateCard />
          </div>
        </div>
      </div>
    </div>
  );
}
