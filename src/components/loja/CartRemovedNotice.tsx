"use client";

import { AlertTriangle, X } from "lucide-react";
import { useCartStore } from "@/store/cart";

/** Aviso dos itens que saíram do carrinho (excluídos, ocultos ou esgotados). */
export function CartRemovedNotice({ className = "" }: { className?: string }) {
  const removed = useCartStore((s) => s.removedNotice);
  const dismiss = useCartStore((s) => s.dismissRemovedNotice);
  if (removed.length === 0) return null;
  return (
    <div className={`flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800 ${className}`}>
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {removed.length === 1 ? "Um item saiu do seu carrinho:" : "Alguns itens saíram do seu carrinho:"}
        </p>
        <ul className="mt-1 list-disc pl-5">
          {removed.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={dismiss} className="shrink-0 rounded-lg p-1 hover:bg-amber-100" aria-label="Fechar aviso">
        <X size={16} />
      </button>
    </div>
  );
}
