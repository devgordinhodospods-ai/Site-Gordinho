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
    <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-display flex items-center gap-2 text-lg text-brand">
          {logoUrl ? (
            <Image src={logoUrl} alt={storeName} width={36} height={36} className="rounded" />
          ) : (
            <span
              className="font-display flex h-9 w-9 items-center justify-center rounded-lg text-white"
              style={{ background: "linear-gradient(135deg, #2563eb, #0f2f8f)" }}
            >
              {storeName.charAt(0).toUpperCase()}
            </span>
          )}
          <span>{storeName}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-bold text-slate-600 md:flex">
          <Link href="/produtos" className="transition-colors hover:text-brand">
            Produtos
          </Link>
          {session?.user && (
            <Link href="/pedidos" className="transition-colors hover:text-brand">
              Meus pedidos
            </Link>
          )}
          {session?.user?.isAdmin && (
            <Link href="/admin" className="flex items-center gap-1 transition-colors hover:text-brand">
              <LayoutDashboard size={16} /> Painel
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/carrinho"
            className="relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-blue-50 hover:text-brand"
            aria-label="Carrinho"
          >
            <ShoppingCart size={22} />
            {mounted && totalQuantity > 0 && (
              <span className="font-display absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs text-white shadow-brand">
                {totalQuantity}
              </span>
            )}
          </Link>

          {session?.user ? (
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-1 rounded-lg p-2 text-sm text-slate-600 transition-colors hover:bg-blue-50 hover:text-brand"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
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
