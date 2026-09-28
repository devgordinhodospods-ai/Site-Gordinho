import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/login?callbackUrl=/admin");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-blue-50/40">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-display mb-4 flex items-center gap-2 text-xl text-slate-900">
          Painel Administrativo
        </h1>
        <AdminNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
