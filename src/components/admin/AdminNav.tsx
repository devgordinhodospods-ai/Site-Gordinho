"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LayoutDashboard, Package, Settings, ShoppingCart, Tags, Bike } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Monitoramento", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/categorias", label: "Categorias", icon: Tags },
  { href: "/admin/frete", label: "Frete", icon: Bike },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();

  const itemClass = (active: boolean) =>
    `flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
      active ? "bg-brand text-white shadow-brand" : "text-slate-600 hover:bg-blue-50 hover:text-brand"
    }`;

  return (
    <nav className="card -mx-1 flex gap-1 overflow-x-auto p-2 [scrollbar-width:none] lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden">
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} className={itemClass(pathname === item.href)}>
          <item.icon size={17} />
          {item.label}
        </Link>
      ))}
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 transition-colors hover:bg-blue-50 hover:text-brand lg:mt-2 lg:border-t lg:border-blue-50 lg:pt-3"
      >
        <ExternalLink size={16} />
        Ver loja
      </Link>
    </nav>
  );
}
