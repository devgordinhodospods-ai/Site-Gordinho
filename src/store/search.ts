import { create } from "zustand";

/**
 * Texto da busca compartilhado entre a barra do topo (Navbar) e a vitrine
 * da home, pra que digitar lá em cima filtre os produtos ao vivo.
 */
export const useSearchStore = create<{ query: string; setQuery: (query: string) => void }>((set) => ({
  query: "",
  setQuery: (query) => set({ query }),
}));

/** Leva a tela até a vitrine, se ela ainda não estiver no topo da tela. */
export function scrollToProducts() {
  const el = document.getElementById("produtos");
  if (!el) return;
  const { top } = el.getBoundingClientRect();
  if (top > 140 || top < -40) el.scrollIntoView({ behavior: "smooth" });
}
