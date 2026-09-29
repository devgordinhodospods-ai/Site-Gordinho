"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SLIDE_MS = 7000;

/**
 * Banner da vitrine: as imagens passam sozinhas a cada 7 s (com uma só,
 * fica parada). Setas no computador, arrastar pro lado no celular.
 * Tamanho ideal das imagens: 1920 × 600 px — assim aparecem inteiras.
 */
export function HeroCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = images.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  // Recomeça a contagem de 7 s a cada troca (automática ou manual).
  useEffect(() => {
    if (count < 2 || paused) return;
    const timer = setTimeout(() => go(index + 1), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, count, paused, go]);

  if (count === 0) return null;

  return (
    <section
      // Proporção fixa 1920×600 (16:5): a imagem ocupa a largura toda da tela
      // em qualquer aparelho, sem faixas pretas nos lados.
      className="relative aspect-[16/5] w-full overflow-hidden bg-black"
      aria-roledescription="carrossel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchStartX.current = null;
      }}
    >
      {images.map((src, i) => (
        <div
          key={`${src}-${i}`}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === index ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={i !== index}
        >
          <Image
            src={src}
            alt={count > 1 ? `${alt} — banner ${i + 1} de ${count}` : alt}
            fill
            priority={i === 0}
            className="object-cover"
            sizes="100vw"
          />
        </div>
      ))}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 sm:flex"
            aria-label="Banner anterior"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 sm:flex"
            aria-label="Próximo banner"
          >
            <ChevronRight size={22} />
          </button>
          <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Ver banner ${i + 1}`}
                aria-current={i === index}
                className="flex h-6 items-center px-0.5"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/50"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
