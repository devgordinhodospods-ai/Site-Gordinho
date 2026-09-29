"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { User, UserCog, Package, LogOut, ChevronDown } from "lucide-react";

export function UserMenu({ name }: { name?: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg p-2 text-slate-600 transition-colors hover:bg-blue-50 hover:text-brand"
        title={name ?? "Minha conta"}
        aria-label="Minha conta"
      >
        <User size={20} />
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-blue-100 bg-white py-1.5 shadow-lg">
          {name && (
            <p className="truncate border-b border-blue-50 px-4 py-2 text-sm font-bold text-slate-800">{name}</p>
          )}
          <Link
            href="/minha-conta"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-brand"
          >
            <UserCog size={16} /> Meus dados
          </Link>
          <Link
            href="/pedidos"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-brand"
          >
            <Package size={16} /> Meus pedidos
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}
