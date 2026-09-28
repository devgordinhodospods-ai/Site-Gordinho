import Link from "next/link";
import { ProductCard } from "@/components/loja/ProductCard";
import type { Product } from "@/lib/types";

export function ProductRow({
  title,
  products,
  seeMoreHref,
}: {
  title: string;
  products: Product[];
  seeMoreHref?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl text-slate-900">{title}</h2>
        {seeMoreHref && (
          <Link href={seeMoreHref} className="btn-secondary px-4 py-1.5 text-xs">
            Ver mais
          </Link>
        )}
      </div>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((p) => (
          <div key={p.id} className="w-40 shrink-0 sm:w-48">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
