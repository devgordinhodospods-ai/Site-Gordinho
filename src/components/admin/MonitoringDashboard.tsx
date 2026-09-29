"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
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
import { Pagination } from "@/components/ui/Pagination";

type PeriodStat = { vendasCents: number; lucroCents: number };

type DashboardStats = {
  totalVendidoCents: number;
  lucroTotalCents: number;
  lucroProdutosCents: number;
  taxasServicoCents: number;
  margemPercent: number;
  itensSemCusto: number;
  totalPedidos: number;
  pedidosPagos: number;
  pedidosPendentes: number;
  pedidosCancelados: number;
  ticketMedioCents: number;
  periodStats: { today: PeriodStat; week: PeriodStat; month: PeriodStat };
  topProducts: {
    name: string;
    quantity: number;
    receitaCents: number;
    lucroCents: number;
    margemPercent: number;
  }[];
  salesByDay: {
    date: string;
    pedidos: number;
    vendasCents: number;
    lucroCents: number;
  }[];
};

const DAYS_PER_PAGE = 10;
const PRODUCTS_PER_PAGE = 8;
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

type Preset = "hoje" | "ontem" | "7dias" | "30dias" | "mes" | "mesPassado" | "tudo" | "custom";

const PRESETS: { id: Exclude<Preset, "custom">; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "ontem", label: "Ontem" },
  { id: "7dias", label: "Últimos 7 dias" },
  { id: "30dias", label: "Últimos 30 dias" },
  { id: "mes", label: "Este mês" },
  { id: "mesPassado", label: "Mês passado" },
  { id: "tudo", label: "Tudo" },
];

/** Dia de hoje (YYYY-MM-DD) no horário de Brasília (UTC-3). */
function todayBrasilia() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function shiftDay(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function presetRange(preset: Exclude<Preset, "custom">): { from: string; to: string } | null {
  const today = todayBrasilia();
  const [y, m] = today.split("-").map(Number);
  switch (preset) {
    case "hoje":
      return { from: today, to: today };
    case "ontem":
      return { from: shiftDay(today, -1), to: shiftDay(today, -1) };
    case "7dias":
      return { from: shiftDay(today, -6), to: today };
    case "30dias":
      return { from: shiftDay(today, -29), to: today };
    case "mes":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "mesPassado": {
      const first = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
      const last = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
      return { from: first, to: last };
    }
    case "tudo":
      return null;
  }
}

function formatDay(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function weekday(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function StatCard({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
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
  const [preset, setPreset] = useState<Preset>("hoje");
  const [from, setFrom] = useState(() => todayBrasilia());
  const [to, setTo] = useState(() => todayBrasilia());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayPage, setDayPage] = useState(1);
  const [productPage, setProductPage] = useState(1);

  const rangeInvalid = preset !== "tudo" && (!from || !to || from > to);

  useEffect(() => {
    if (rangeInvalid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi<DashboardStats>("getDashboardStats", preset === "tudo" ? {} : { from, to })
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setDayPage(1);
        setProductPage(1);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar estatísticas.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preset, from, to, rangeInvalid]);

  function choosePreset(id: Exclude<Preset, "custom">) {
    setPreset(id);
    const range = presetRange(id);
    if (range) {
      setFrom(range.from);
      setTo(range.to);
    }
  }

  function chooseDate(which: "from" | "to", value: string) {
    // Saindo de "Tudo" sem datas, preenche a outra ponta com a mesma data.
    if (which === "from") {
      setFrom(value);
      if (preset === "tudo" || !to) setTo(value);
    } else {
      setTo(value);
      if (preset === "tudo" || !from) setFrom(value);
    }
    setPreset("custom");
  }

  const periodLabel =
    preset === "tudo"
      ? "Desde o começo"
      : from === to
        ? `${weekday(from)}, ${formatDay(from)}`
        : `${formatDay(from)} até ${formatDay(to)}`;

  const periodPicker = (
    <div className="card mb-6 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
        <CalendarDays size={16} className="text-brand" /> Período
      </div>
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choosePreset(p.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              preset === p.id
                ? "border-brand bg-brand text-white shadow-brand"
                : "border-blue-100 bg-white text-slate-600 hover:border-brand hover:text-brand"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
        <label className="block text-xs font-semibold text-slate-500">
          De
          <input
            type="date"
            className="input mt-1"
            value={preset === "tudo" ? "" : from}
            max={todayBrasilia()}
            onChange={(e) => chooseDate("from", e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-slate-500">
          Até
          <input
            type="date"
            className="input mt-1"
            value={preset === "tudo" ? "" : to}
            max={todayBrasilia()}
            onChange={(e) => chooseDate("to", e.target.value)}
          />
        </label>
      </div>
      {rangeInvalid ? (
        <p className="mt-2 text-sm text-red-600">A data inicial precisa ser antes (ou igual) da data final.</p>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          Mostrando: <span className="font-semibold text-slate-800">{periodLabel}</span>
        </p>
      )}
    </div>
  );

  if (!stats) {
    return (
      <div>
        <h1 className="font-display mb-4 text-2xl text-slate-900">Visão geral</h1>
        {periodPicker}
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        )}
      </div>
    );
  }

  const dayPages = Math.max(1, Math.ceil(stats.salesByDay.length / DAYS_PER_PAGE));
  const daysShown = stats.salesByDay.slice((dayPage - 1) * DAYS_PER_PAGE, dayPage * DAYS_PER_PAGE);
  const productPages = Math.max(1, Math.ceil(stats.topProducts.length / PRODUCTS_PER_PAGE));
  const productOffset = (productPage - 1) * PRODUCTS_PER_PAGE;
  const productsShown = stats.topProducts.slice(productOffset, productOffset + PRODUCTS_PER_PAGE);

  return (
    <div>
      <h1 className="font-display mb-1 text-2xl text-slate-900">Visão geral</h1>
      <p className="mb-6 text-sm text-slate-500">
        Conta só pedidos pagos. Lucro = preço de venda − custo do produto + taxa de serviço (o frete vai direto pro
        entregador e a tarifa do Mercado Pago não entra na conta). Datas no horário de Brasília.
      </p>

      {periodPicker}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className={`transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`} aria-busy={loading}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard
            icon={DollarSign}
            label="Total vendido"
            value={centsToBRL(stats.totalVendidoCents)}
            sub="Pedidos pagos (produtos + taxa)"
          />
          <StatCard
            icon={TrendingUp}
            label="Lucro total"
            value={centsToBRL(stats.lucroTotalCents)}
            sub={`Margem ${stats.margemPercent.toFixed(1)}% · produtos ${centsToBRL(stats.lucroProdutosCents)} + taxas ${centsToBRL(stats.taxasServicoCents)}`}
          />
          <StatCard
            icon={ShoppingBag}
            label="Total de pedidos"
            value={String(stats.totalPedidos)}
            sub="No período, todos os status"
          />
          <StatCard
            icon={CheckCircle2}
            label="Pedidos pagos"
            value={String(stats.pedidosPagos)}
            sub="Status: pago em diante"
          />
          <StatCard
            icon={Clock}
            label="Pedidos pendentes"
            value={String(stats.pedidosPendentes)}
            sub="Aguardando pagamento"
          />
          <StatCard
            icon={XCircle}
            label="Pedidos cancelados"
            value={String(stats.pedidosCancelados)}
            sub="Status: cancelado"
          />
          <StatCard
            icon={Wallet}
            label="Ticket médio"
            value={centsToBRL(stats.ticketMedioCents)}
            sub="Por pedido pago"
          />
        </div>

        {stats.itensSemCusto > 0 && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {stats.itensSemCusto} {stats.itensSemCusto === 1 ? "item vendido não tem" : "itens vendidos não têm"} valor
            de custo cadastrado — pra esses, o lucro considera custo zero e fica maior do que o real. Cadastre o custo
            em Produtos pra ter o lucro certo nas próximas vendas.
          </p>
        )}

        <div className="card mt-6 p-4">
          <h2 className="font-display mb-3 text-lg text-slate-900">Resumo rápido</h2>
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

        <div id="vendas-por-dia" className="card mt-6 scroll-mt-24 overflow-x-auto p-4">
          <h2 className="font-display mb-3 flex items-center gap-2 text-lg text-slate-900">
            <CalendarDays size={18} className="text-brand" /> Vendas por dia
          </h2>
          {stats.salesByDay.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma venda paga nesse período.</p>
          ) : (
            <>
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-white">
                    <th className="rounded-l-lg bg-brand px-3 py-2">Dia</th>
                    <th className="bg-brand px-3 py-2 text-right">Pedidos pagos</th>
                    <th className="bg-brand px-3 py-2 text-right">Vendas</th>
                    <th className="rounded-r-lg bg-brand px-3 py-2 text-right">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {daysShown.map((d) => (
                    <tr
                      key={d.date}
                      className={`border-b border-blue-50 last:border-0 ${d.pedidos === 0 ? "text-slate-400" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium">
                        <span className={d.pedidos === 0 ? "" : "text-slate-800"}>{formatDay(d.date)}</span>{" "}
                        <span className="text-xs text-slate-400">{weekday(d.date)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{d.pedidos}</td>
                      <td className="px-3 py-2 text-right">{centsToBRL(d.vendasCents)}</td>
                      <td className="px-3 py-2 text-right">{centsToBRL(d.lucroCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={dayPage}
                totalPages={dayPages}
                onChange={setDayPage}
                scrollTarget="vendas-por-dia"
                compact
              />
            </>
          )}
        </div>

        <div id="top-produtos" className="card mt-6 scroll-mt-24 overflow-x-auto p-4">
          <h2 className="font-display mb-3 flex items-center gap-2 text-lg text-slate-900">
            <Trophy size={18} className="text-brand" /> Top produtos vendidos
          </h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma venda nesse período.</p>
          ) : (
            <>
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
                  {productsShown.map((p, i) => (
                    <tr key={p.name + i} className="border-b border-blue-50 last:border-0">
                      <td className="px-3 py-2 text-slate-400">{productOffset + i + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                      <td className="px-3 py-2 text-right">{p.quantity}</td>
                      <td className="px-3 py-2 text-right">{centsToBRL(p.receitaCents)}</td>
                      <td className="px-3 py-2 text-right">{centsToBRL(p.lucroCents)}</td>
                      <td className="px-3 py-2 text-right">{p.margemPercent.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={productPage}
                totalPages={productPages}
                onChange={setProductPage}
                scrollTarget="top-produtos"
                compact
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
