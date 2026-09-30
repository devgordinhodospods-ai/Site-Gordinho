"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Alterna entre modo claro e escuro. A escolha fica salva no navegador
 * (localStorage "theme"); o script no <head> do layout aplica antes da
 * página aparecer, pra não piscar.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const dark = !root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // Navegador bloqueando armazenamento: troca só nesta visita.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={className}
      aria-label="Alternar modo claro/escuro"
      title="Modo claro/escuro"
    >
      <Moon size={20} className="dark:hidden" />
      <Sun size={20} className="hidden dark:block" />
    </button>
  );
}
