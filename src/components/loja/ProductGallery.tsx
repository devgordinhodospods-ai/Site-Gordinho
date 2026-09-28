"use client";

import { useState } from "react";
import Image from "next/image";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-blue-100 bg-slate-100">
        {current ? (
          <Image src={current} alt={name} fill priority className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">Sem imagem</div>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === active ? "border-brand" : "border-transparent opacity-70 hover:opacity-100"
              }`}
              aria-label={`Ver foto ${i + 1}`}
            >
              <Image src={src} alt="" fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
