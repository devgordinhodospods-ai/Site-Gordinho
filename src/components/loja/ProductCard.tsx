import Image from "next/image";
import Link from "next/link";
import { centsToBRL } from "@/lib/money";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images?.[0];
  const outOfStock = product.stock <= 0;

  return (
    <Link href={`/produto/${product.slug}`} className="card group overflow-hidden">
      <div className="relative aspect-square bg-slate-100">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            className="object-cover transition group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">Sem imagem</div>
        )}
        {outOfStock && (
          <span className="absolute left-2 top-2 rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
            Esgotado
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{product.name}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-bold">{centsToBRL(product.price_cents)}</span>
          {product.compare_at_price_cents && product.compare_at_price_cents > product.price_cents && (
            <span className="text-xs text-slate-400 line-through">
              {centsToBRL(product.compare_at_price_cents)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
