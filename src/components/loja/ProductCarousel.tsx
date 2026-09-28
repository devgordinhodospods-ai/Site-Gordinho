"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/loja/ProductCard";
import type { ProductWithFlavors } from "@/lib/types";

export function ProductCarousel({
  title,
  products,
  onSeeAll,
}: {
  title: string;
  products: ProductWithFlavors[];
  onSeeAll?: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  function updateArrows() {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [products]);

  function scrollBy(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }

  const arrowClass =
    "hidden h-9 w-9 items-center justify-center rounded-full border border-blue-100 bg-white text-brand shadow-sm transition hover:border-brand disabled:opacity-30 sm:flex";

  return (
    <div className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-slate-900">{title}</h3>
        <div className="flex items-center gap-2">
          {onSeeAll && (
            <button type="button" onClick={onSeeAll} className="mr-1 text-sm text-brand hover:underline">
              Ver todos
            </button>
          )}
          <button
            type="button"
            className={arrowClass}
            onClick={() => scrollBy(-1)}
            disabled={!canPrev}
            aria-label="Anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className={arrowClass}
            onClick={() => scrollBy(1)}
            disabled={!canNext}
            aria-label="Próximo"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={updateArrows}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div key={p.id} className="flex w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[calc(25%-12px)]">
            <div className="w-full [&>a]:h-full">
              <ProductCard product={p} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
