import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/lib/types";

export function CategoryGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="font-display mb-4 text-xl text-slate-900">Compre por categoria</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {categories.slice(0, 8).map((cat) => (
          <Link
            key={cat.id}
            href={`/produtos?categoria=${cat.slug}`}
            className="group relative aspect-square overflow-hidden rounded-2xl shadow-[0_4px_20px_-6px_rgba(29,78,216,0.15)]"
          >
            {cat.image_url ? (
              <Image
                src={cat.image_url}
                alt={cat.name}
                fill
                className="object-cover transition group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: "linear-gradient(160deg, #2563eb, #0f2f8f)" }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <span className="font-display absolute bottom-3 left-3 text-white">{cat.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
