"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { ShoppingCart, User, LogOut, LayoutDashboard } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useEffect, useState } from "react";

export function Navbar({
  storeName,
  logoUrl,
}: {
  storeName: string;
  logoUrl: string | null;
}) {
  const { data: session } = useSession();
  const totalQuantity = useCartStore((s) => s.totalQuantity());
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          {logoUrl ? (
            <Image src={logoUrl} alt={storeName} width={36} height={36} className="rounded" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded bg-neutral-900 text-white">
              {storeName.charAt(0).toUpperCase()}
            </span>
          )}
          <span>{storeName}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-neutral-700 md:flex">
          <Link href="/produtos" className="hover:text-neutral-950">
            Produtos
          </Link>
          {session?.user && (
            <Link href="/pedidos" className="hover:text-neutral-950">
              Meus pedidos
            </Link>
          )}
          {session?.user?.isAdmin && (
            <Link href="/admin" className="flex items-center gap-1 hover:text-neutral-950">
              <LayoutDashboard size={16} /> Painel
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/carrinho" className="relative rounded-md p-2 hover:bg-neutral-100" aria-label="Carrinho">
            <ShoppingCart size={22} />
            {mounted && totalQuantity > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                {totalQuantity}
              </span>
            )}
          </Link>

          {session?.user ? (
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-1 rounded-md p-2 text-sm hover:bg-neutral-100"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          ) : (
            <Link href="/login" className="flex items-center gap-1 rounded-md p-2 hover:bg-neutral-100" title="Entrar">
              <User size={20} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
