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
      <section
        className="py-20 text-center text-white"
        style={{ background: "linear-gradient(160deg, #1d4ed8 0%, #0f2f8f 100%)" }}
      >
        <h1 className="font-display text-3xl sm:text-4xl">{settings.store_name}</h1>
        <p className="mx-auto mt-3 max-w-xl text-blue-100">
          Confira nossos produtos e faça seu pedido com entrega rápida.
        </p>
        <Link
          href="/produtos"
          className="btn-secondary mt-6 inline-flex border-white bg-white text-brand hover:border-white hover:bg-blue-50"
        >
          Ver produtos
        </Link>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="font-display mb-4 text-xl">Novidades</h2>
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
    </div>
  );
}
