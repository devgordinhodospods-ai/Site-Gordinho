import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteSettings } from "@/lib/settings";
import { ProductCard } from "@/components/loja/ProductCard";
import type { Product } from "@/lib/types";

async function getFeaturedProducts(): Promise<Product[]> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}

export default async function HomePage() {
  const [settings, products] = await Promise.all([getSiteSettings(), getFeaturedProducts()]);

  return (
    <div>
      <section className="bg-neutral-900 py-16 text-center text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">{settings.store_name}</h1>
        <p className="mx-auto mt-3 max-w-xl text-neutral-300">
          Confira nossos produtos e faça seu pedido com entrega rápida.
        </p>
        <Link href="/produtos" className="btn-primary mt-6 inline-flex bg-accent hover:bg-accent-light">
          Ver produtos
        </Link>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-4 text-xl font-bold">Novidades</h2>
        {products.length === 0 ? (
          <p className="text-neutral-500">
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
    </div>
  );
}
