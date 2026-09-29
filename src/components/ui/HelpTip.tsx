"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Botão "?" que abre uma explicação em um balão do próprio site (não usa o
 * title nativo do navegador, que é lento pra aparecer e não funciona bem no
 * celular). Clique fora ou Esc fecha o balão.
 */
export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Balão com posição fixa, sempre dentro da tela (no celular o "?" pode
  // ficar colado na borda).
  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) {
      const width = Math.min(240, window.innerWidth - 16);
      const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, 8), window.innerWidth - width - 8);
      const above = r.top > 160;
      setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const close = () => setOpen(false);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        ref={buttonRef}
        onClick={toggle}
        aria-label="Ajuda"
        aria-expanded={open}
        className="relative ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition before:absolute before:-inset-2.5 before:content-[''] hover:text-brand"
      >
        <HelpCircle size={14} />
      </button>
      {open && pos && (
        <span
          role="tooltip"
          style={{ left: pos.left, top: pos.top, width: Math.min(240, window.innerWidth - 16) }}
          className={`fixed z-[70] rounded-lg border border-slate-200 bg-white p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-slate-600 shadow-lg ${
            pos.above ? "-translate-y-full" : ""
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
