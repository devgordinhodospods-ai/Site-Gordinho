"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { centsToBRL } from "@/lib/money";
import { Loader } from "@/components/ui/Loader";

type PeriodStat = { vendasCents: number; lucroCents: number };

type DashboardStats = {
  totalVendidoCents: number;
  lucroTotalCents: number;
  margemPercent: number;
  totalPedidos: number;
  pedidosPagos: number;
  pedidosPendentes: number;
  pedidosCancelados: number;
  ticketMedioCents: number;
  periodStats: { today: PeriodStat; week: PeriodStat; month: PeriodStat };
  topProducts: { name: string; quantity: number; receitaCents: number; lucroCents: number; margemPercent: number }[];
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card border-t-4 border-t-brand p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
        <Icon size={14} /> {label}
      </div>
      <p className="font-display text-2xl text-brand">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function MonitoringDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi<DashboardStats>("getDashboardStats")
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar estatísticas."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader />
      </div>
    );
  }

  if (error || !stats) {
    return <p className="text-sm text-red-600">{error ?? "Não foi possível carregar o dashboard."}</p>;
  }

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl text-slate-900">Visão geral</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Total vendido" value={centsToBRL(stats.totalVendidoCents)} sub="Pedidos pagos" />
        <StatCard
          icon={TrendingUp}
          label="Lucro total"
          value={centsToBRL(stats.lucroTotalCents)}
          sub={`Margem: ${stats.margemPercent.toFixed(1)}%`}
        />
        <StatCard icon={ShoppingBag} label="Total de pedidos" value={String(stats.totalPedidos)} sub="Todos os status" />
        <StatCard icon={CheckCircle2} label="Pedidos pagos" value={String(stats.pedidosPagos)} sub="Status: pago em diante" />
        <StatCard icon={Clock} label="Pedidos pendentes" value={String(stats.pedidosPendentes)} sub="Aguardando pagamento" />
        <StatCard icon={XCircle} label="Pedidos cancelados" value={String(stats.pedidosCancelados)} sub="Status: cancelado" />
        <StatCard icon={Wallet} label="Ticket médio" value={centsToBRL(stats.ticketMedioCents)} sub="Por pedido pago" />
      </div>

      <div className="card mt-6 p-4">
        <h2 className="font-display mb-3 text-lg text-slate-900">Desempenho por período</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Hoje", stats.periodStats.today],
              ["Esta semana", stats.periodStats.week],
              ["Este mês", stats.periodStats.month],
            ] as const
          ).map(([label, period]) => (
            <div key={label} className="rounded-xl bg-blue-50 p-4">
              <p className="mb-2 text-sm font-bold text-brand">{label}</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Vendas</span>
                <span className="font-bold text-slate-900">{centsToBRL(period.vendasCents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Lucro</span>
                <span className="font-bold text-slate-900">{centsToBRL(period.lucroCents)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto p-4">
        <h2 className="font-display mb-3 flex items-center gap-2 text-lg text-slate-900">
          <Trophy size={18} className="text-brand" /> Top produtos vendidos
        </h2>
        {stats.topProducts.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma venda registrada ainda.</p>
        ) : (
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-white">
                <th className="rounded-l-lg bg-brand px-3 py-2">#</th>
                <th className="bg-brand px-3 py-2">Produto</th>
                <th className="bg-brand px-3 py-2 text-right">Quantidade</th>
                <th className="bg-brand px-3 py-2 text-right">Receita</th>
                <th className="bg-brand px-3 py-2 text-right">Lucro</th>
                <th className="rounded-r-lg bg-brand px-3 py-2 text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {stats.topProducts.map((p, i) => (
                <tr key={p.name + i} className="border-b border-blue-50 last:border-0">
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                  <td className="px-3 py-2 text-right">{p.quantity}</td>
                  <td className="px-3 py-2 text-right">{centsToBRL(p.receitaCents)}</td>
                  <td className="px-3 py-2 text-right">{centsToBRL(p.lucroCents)}</td>
                  <td className="px-3 py-2 text-right">{p.margemPercent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
