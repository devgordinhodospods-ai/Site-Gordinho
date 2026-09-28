import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";

const NAV = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/frete", label: "Frete" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/configuracoes", label: "Configurações da loja" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/login?callbackUrl=/admin");
  }

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
      <aside className="w-56 flex-shrink-0">
        <h2 className="mb-4 text-lg font-bold">Painel admin</h2>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
