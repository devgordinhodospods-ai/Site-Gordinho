"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShoppingCart, User, LayoutDashboard, Search } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useEffect, useRef } from "react";
import { scrollToProducts, useSearchStore } from "@/store/search";
import { UserMenu } from "@/components/layout/UserMenu";
import { SmoothTopLink } from "@/components/ui/SmoothTopLink";

export function Navbar({ storeName, logoUrl }: { storeName: string; logoUrl: string | null }) {
  const router = useRouter();
  const { data: session } = useSession();
  const totalQuantity = useCartStore((s) => s.totalQuantity());
  const cartHydrated = useCartStore((s) => s.hydrated);
  const pathname = usePathname();
  const onHome = pathname === "/";
  const search = useSearchStore((s) => s.query);
  const setSearch = useSearchStore((s) => s.setQuery);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function goToResults(value: string) {
    const q = value.trim();
    router.push(q ? `/?busca=${encodeURIComponent(q)}#produtos` : "/#produtos");
  }

  // Na home a vitrine filtra ao vivo; em outra página, uma pausa na
  // digitação já leva pra home com os resultados. Só reage ao que o
  // cliente digita — navegar pra outra página nunca dispara a busca.
  function handleChange(value: string) {
    setSearch(value);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (!value.trim()) return;
    if (onHome) scrollToProducts();
    else typingTimer.current = setTimeout(() => goToResults(value), 700);
  }

  // Saiu da home (carrinho, produto, conta...): a busca fica vazia.
  useEffect(() => {
    if (onHome) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setSearch("");
  }, [onHome, pathname, setSearch]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (onHome) scrollToProducts();
    else goToResults(search);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap md:gap-6">
        <SmoothTopLink
          href="/"
          aria-label={storeName}
          className="font-display flex shrink-0 items-center gap-2 text-lg text-brand"
        >
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={storeName}
              width={160}
              height={56}
              priority
              className="h-12 w-auto max-w-[160px] rounded-lg object-contain sm:h-14"
            />
          ) : (
            <>
              <span
                className="font-display flex h-9 w-9 items-center justify-center rounded-lg text-white"
                style={{ background: "linear-gradient(135deg, #2563eb, #0f2f8f)" }}
              >
                {storeName.charAt(0).toUpperCase()}
              </span>
              <span>{storeName}</span>
            </>
          )}
        </SmoothTopLink>

        <form onSubmit={handleSearch} className="order-3 w-full md:order-none md:max-w-md md:flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="input pl-10"
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => handleChange(e.target.value)}
            />
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {session?.user?.isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-blue-50 hover:text-brand"
              aria-label="Painel"
            >
              <LayoutDashboard size={16} /> <span className="hidden sm:inline">Painel</span>
            </Link>
          )}

          <Link
            href="/carrinho"
            className="relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-blue-50 hover:text-brand"
            aria-label="Carrinho"
          >
            <ShoppingCart size={22} />
            {cartHydrated && totalQuantity > 0 && (
              <span className="font-display absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs text-white shadow-brand">
                {totalQuantity}
              </span>
            )}
          </Link>

          {session?.user ? (
            <UserMenu name={session.user.name} />
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1 rounded-lg p-2 text-slate-600 transition-colors hover:bg-blue-50 hover:text-brand"
              title="Entrar"
            >
              <User size={20} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
