import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export default async function AdminHomePage() {
  const db = getSupabaseAdmin();
  const [{ count: productCount }, { count: pendingOrders }, { count: totalOrders }] = await Promise.all([
    db.from("products").select("*", { count: "exact", head: true }),
    db.from("orders").select("*", { count: "exact", head: true }).eq("status", "paid"),
    db.from("orders").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Visão geral</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Produtos cadastrados</p>
          <p className="text-2xl font-bold">{productCount ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Pedidos pagos (a confirmar)</p>
          <p className="text-2xl font-bold">{pendingOrders ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Total de pedidos</p>
          <p className="text-2xl font-bold">{totalOrders ?? 0}</p>
        </div>
      </div>
      <div className="mt-6 space-x-3">
        <Link href="/admin/produtos" className="btn-primary inline-flex">
          Gerenciar produtos
        </Link>
        <Link href="/admin/pedidos" className="btn-secondary inline-flex">
          Ver pedidos
        </Link>
      </div>
    </div>
  );
}
