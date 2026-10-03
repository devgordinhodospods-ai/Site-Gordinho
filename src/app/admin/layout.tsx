import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { AdminNav } from "@/components/admin/AdminNav";
import { NewOrderAlert } from "@/components/admin/NewOrderAlert";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/login?callbackUrl=/admin");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-blue-50/40">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:grid lg:grid-cols-[220px_1fr] lg:items-start lg:gap-8">
        {/* Menu e botão do som grudam juntos ao rolar (senão um entra por cima do outro). */}
        <aside className="lg:sticky lg:top-24">
          <p className="font-display mb-3 hidden text-xs uppercase tracking-widest text-slate-400 lg:block">
            Painel administrativo
          </p>
          <AdminNav />
          <NewOrderAlert />
        </aside>
        <div className="mt-6 min-w-0 lg:mt-0">{children}</div>
      </div>
    </div>
  );
}
