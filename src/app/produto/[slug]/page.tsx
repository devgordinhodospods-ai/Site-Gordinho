import Image from "next/image";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { centsToBRL } from "@/lib/money";
import { AddToCartButton } from "@/components/loja/AddToCartButton";
import type { Product } from "@/lib/types";

async function getProduct(slug: string): Promise<Product | null> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("products")
    .select("*")
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
          {image ? (
            <Image src={image} alt={product.name} fill className="object-cover" sizes="50vw" />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-400">Sem imagem</div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{centsToBRL(product.price_cents)}</p>
          {product.description && (
            <p className="mt-4 whitespace-pre-line text-neutral-600">{product.description}</p>
          )}
          <p className="mt-2 text-sm text-neutral-500">
            {product.stock > 0 ? `${product.stock} em estoque` : "Sem estoque no momento"}
          </p>

          <div className="mt-6">
            <AddToCartButton product={product} />
          </div>
        </div>
      </div>
    </div>
  );
}
