"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Receipt,
  Globe,
  Sparkles,
  Store,
  Table2,
  Trophy,
  XCircle,
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
  canais?: { site: { pedidos: number; vendasCents: number }; balcao: { pedidos: number; vendasCents: number } };
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
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** Acima disso o gráfico agrupa por mês (barras finas demais não dão pra ler). */
const MAX_DAY_BARS = 62;

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

type Bar = { key: string; label: string; short: string; pedidos: number; vendasCents: number; lucroCents: number };

/** Barras do gráfico: um dia por barra, ou um mês por barra em períodos longos. */
function buildBars(days: DashboardStats["salesByDay"]): { bars: Bar[]; byMonth: boolean } {
  const asc = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (asc.length <= MAX_DAY_BARS) {
    return {
      byMonth: false,
      bars: asc.map((d) => ({
        key: d.date,
        label: `${weekday(d.date)}, ${formatDay(d.date)}`,
        short: d.date.slice(8, 10) + "/" + d.date.slice(5, 7),
        pedidos: d.pedidos,
        vendasCents: d.vendasCents,
        lucroCents: d.lucroCents,
      })),
    };
  }
  const months = new Map<string, Bar>();
  for (const d of asc) {
    const key = d.date.slice(0, 7);
    const [y, m] = key.split("-").map(Number);
    const bar = months.get(key) ?? {
      key,
      label: `${MONTHS[m - 1]} de ${y}`,
      short: `${MONTHS[m - 1]}/${String(y).slice(2)}`,
      pedidos: 0,
      vendasCents: 0,
      lucroCents: 0,
    };
    bar.pedidos += d.pedidos;
    bar.vendasCents += d.vendasCents;
    bar.lucroCents += d.lucroCents;
    months.set(key, bar);
  }
  return { byMonth: true, bars: [...months.values()] };
}

function SalesChart({ bars, byMonth }: { bars: Bar[]; byMonth: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...bars.map((b) => b.vendasCents), 0);
  // Rótulos do eixo: no máximo ~8, espalhados.
  const labelEvery = Math.max(1, Math.ceil(bars.length / 8));
  const active = hover != null ? bars[hover] : null;

  if (max === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 text-center">
        <BarChart3 className="mb-2 text-slate-300" size={28} />
        <p className="text-sm text-slate-500">Nenhuma venda paga nesse período.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className="relative flex h-52 items-end gap-[2px] border-b border-slate-200 sm:h-60"
        onMouseLeave={() => setHover(null)}
      >
        {/* Grade leve: metade e topo */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-slate-100" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100" />
        <span className="pointer-events-none absolute -top-2 right-0 bg-white pl-1 text-[10px] text-slate-400">
          {centsToBRL(max)}
        </span>
        {bars.map((b, i) => {
          const h = b.vendasCents > 0 ? Math.max(3, (b.vendasCents / max) * 100) : 0;
          return (
            <button
              key={b.key}
              type="button"
              className="group relative flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              aria-label={`${b.label}: ${centsToBRL(b.vendasCents)} em ${b.pedidos} pedidos`}
            >
              <span
                className={`block w-full max-w-10 rounded-t transition-colors ${
                  hover === i ? "bg-brand-dark" : "bg-brand"
                } ${hover != null && hover !== i ? "opacity-40" : ""}`}
                style={{ height: `${h}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {bars.map((b, i) => (
          <span key={b.key} className="min-w-0 flex-1 text-center text-[10px] leading-tight text-slate-400">
            {i % labelEvery === 0 ? b.short : ""}
          </span>
        ))}
      </div>

      {active && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-48 -translate-x-1/2 theme-static rounded-xl bg-brand-ink px-3 py-2 text-xs text-slate-300 shadow-xl"
          style={{
            left: `clamp(96px, ${((hover! + 0.5) / bars.length) * 100}%, calc(100% - 96px))`,
          }}
        >
          <p className="mb-1 font-bold text-white">{active.label}</p>
          <p className="flex justify-between">
            <span>Vendas</span> <span className="font-bold text-white">{centsToBRL(active.vendasCents)}</span>
          </p>
          <p className="flex justify-between">
            <span>Lucro</span> <span className="font-bold text-white">{centsToBRL(active.lucroCents)}</span>
          </p>
          <p className="flex justify-between">
            <span>Pedidos pagos</span> <span className="font-bold text-white">{active.pedidos}</span>
          </p>
        </div>
      )}
      {byMonth && <p className="mt-2 text-xs text-slate-400">Período longo: cada barra é um mês.</p>}
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 backdrop-blur">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon size={14} className="text-brand" /> {label}
      </p>
      <p className="font-display mt-1 text-xl text-slate-900 sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

const STATUS_PARTS = [
  { key: "pagos", label: "Pagos", icon: CheckCircle2, bar: "bg-emerald-500", text: "text-emerald-600" },
  { key: "pendentes", label: "Aguardando Pix", icon: Clock, bar: "bg-amber-400", text: "text-amber-600" },
  { key: "cancelados", label: "Cancelados", icon: XCircle, bar: "bg-rose-500", text: "text-rose-600" },
] as const;

export function MonitoringDashboard() {
  const [preset, setPreset] = useState<Preset>("hoje");
  const [from, setFrom] = useState(() => todayBrasilia());
  const [to, setTo] = useState(() => todayBrasilia());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayPage, setDayPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const [showTable, setShowTable] = useState(false);

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

  const chart = useMemo(() => buildBars(stats?.salesByDay ?? []), [stats]);

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

  const dateInput =
    "mt-1 w-full rounded-xl border-2 border-blue-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-4 focus:ring-blue-100";

  const hero = (
    <section
      className="bg-soft relative overflow-hidden rounded-3xl border border-blue-100 p-5 shadow-[0_10px_40px_-16px_rgba(14,165,233,0.35)] sm:p-7"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-brand">
            <Sparkles size={14} /> Monitoramento
          </p>
          <h1 className="font-display mt-1 text-2xl text-slate-900 sm:text-3xl">Como a loja está indo</h1>
          <p className="mt-1 text-sm text-slate-500">{rangeInvalid ? "Período inválido" : periodLabel}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
          <label className="block text-[11px] uppercase tracking-wide text-slate-500">
            De
            <input
              type="date"
              className={dateInput}
              value={preset === "tudo" ? "" : from}
              max={todayBrasilia()}
              onChange={(e) => chooseDate("from", e.target.value)}
            />
          </label>
          <label className="block text-[11px] uppercase tracking-wide text-slate-500">
            Até
            <input
              type="date"
              className={dateInput}
              value={preset === "tudo" ? "" : to}
              max={todayBrasilia()}
              onChange={(e) => chooseDate("to", e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="relative -mx-5 mt-4 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choosePreset(p.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              preset === p.id
                ? "bg-brand text-white shadow-brand"
                : "border border-blue-100 bg-white text-slate-600 hover:border-brand hover:text-brand"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {rangeInvalid && (
        <p className="relative mt-3 text-sm text-red-600">A data inicial precisa ser antes (ou igual) da data final.</p>
      )}

      {stats && (
        <div
          className={`relative mt-6 grid gap-3 transition-opacity lg:grid-cols-[1.3fr_1fr] ${loading ? "opacity-50" : ""}`}
        >
          <div
            className="theme-static rounded-2xl p-5 text-white shadow-brand"
            style={{ background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 45%, #0284c7 100%)" }}
          >
            <p className="text-sm text-blue-50">Faturamento</p>
            <p className="font-display mt-1 text-4xl tracking-tight sm:text-5xl">
              {centsToBRL(stats.totalVendidoCents)}
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-xs text-blue-100">Lucro</p>
                <p className="font-display text-2xl">{centsToBRL(stats.lucroTotalCents)}</p>
              </div>
              <span className="mb-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold text-white">
                margem {stats.margemPercent.toFixed(1)}%
              </span>
            </div>
            <p className="mt-2 text-[11px] text-blue-100">
              Produtos {centsToBRL(stats.lucroProdutosCents)} + taxas de serviço {centsToBRL(stats.taxasServicoCents)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Metric icon={CheckCircle2} label="Pedidos pagos" value={String(stats.pedidosPagos)} />
            <Metric icon={Receipt} label="Ticket médio" value={centsToBRL(stats.ticketMedioCents)} />
            <Metric
              icon={BarChart3}
              label="Pedidos feitos"
              value={String(stats.totalPedidos)}
              hint="Inclui não pagos"
            />
            <Metric
              icon={Trophy}
              label="Itens vendidos"
              value={String(stats.topProducts.reduce((n, p) => n + p.quantity, 0))}
            />
          </div>
        </div>
      )}
    </section>
  );

  if (!stats) {
    return (
      <div>
        {hero}
        {error ? (
          <p className="mt-6 text-sm text-red-600">{error}</p>
        ) : (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        )}
      </div>
    );
  }

  const statusCounts = {
    pagos: stats.pedidosPagos,
    pendentes: stats.pedidosPendentes,
    cancelados: stats.pedidosCancelados,
  };
  const statusTotal = statusCounts.pagos + statusCounts.pendentes + statusCounts.cancelados;
  const conversion = statusTotal > 0 ? (statusCounts.pagos / statusTotal) * 100 : 0;

  const dayPages = Math.max(1, Math.ceil(stats.salesByDay.length / DAYS_PER_PAGE));
  const daysShown = stats.salesByDay.slice((dayPage - 1) * DAYS_PER_PAGE, dayPage * DAYS_PER_PAGE);
  const productPages = Math.max(1, Math.ceil(stats.topProducts.length / PRODUCTS_PER_PAGE));
  const productOffset = (productPage - 1) * PRODUCTS_PER_PAGE;
  const productsShown = stats.topProducts.slice(productOffset, productOffset + PRODUCTS_PER_PAGE);
  const topReceita = stats.topProducts[0]?.receitaCents ?? 0;

  const quick = [
    ["Hoje", stats.periodStats.today],
    ["Esta semana", stats.periodStats.week],
    ["Este mês", stats.periodStats.month],
  ] as const;

  return (
    <div className={loading ? "cursor-progress" : ""} aria-busy={loading}>
      {hero}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className={`transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`}>
        {stats.itensSemCusto > 0 && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>
              {stats.itensSemCusto} {stats.itensSemCusto === 1 ? "item vendido não tem" : "itens vendidos não têm"}{" "}
              custo cadastrado — pra esses o lucro considera custo zero e fica maior que o real. Cadastre o custo em
              Produtos.
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr] xl:items-start">
          <section id="vendas-por-dia" className="card scroll-mt-24 p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg text-slate-900">Vendas no período</h2>
                <p className="text-xs text-slate-500">Toque ou passe o mouse nas barras pra ver o dia</p>
              </div>
              {stats.salesByDay.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTable((v) => !v)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
                >
                  {showTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
                  {showTable ? "Ver gráfico" : "Ver tabela"}
                </button>
              )}
            </div>

            {showTable ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3 font-semibold">Dia</th>
                      <th className="px-3 py-2 text-right font-semibold">Pedidos</th>
                      <th className="px-3 py-2 text-right font-semibold">Vendas</th>
                      <th className="py-2 pl-3 text-right font-semibold">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daysShown.map((d) => (
                      <tr
                        key={d.date}
                        className={`border-b border-slate-50 ${d.pedidos === 0 ? "text-slate-400" : "text-slate-700"}`}
                      >
                        <td className="py-2 pr-3">
                          {formatDay(d.date)} <span className="text-xs text-slate-400">{weekday(d.date)}</span>
                        </td>
                        <td className="px-3 py-2 text-right">{d.pedidos}</td>
                        <td className="px-3 py-2 text-right">{centsToBRL(d.vendasCents)}</td>
                        <td className="py-2 pl-3 text-right">{centsToBRL(d.lucroCents)}</td>
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
              </div>
            ) : (
              <SalesChart bars={chart.bars} byMonth={chart.byMonth} />
            )}
          </section>

          <div className="flex flex-col gap-5">
            <section className="card p-5">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-lg text-slate-900">Pedidos</h2>
                <span className="text-xs text-slate-500">
                  {statusTotal > 0 ? `${conversion.toFixed(0)}% viraram venda` : "Nenhum pedido"}
                </span>
              </div>
              <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-slate-100">
                {statusTotal > 0 &&
                  STATUS_PARTS.map((part) =>
                    statusCounts[part.key] > 0 ? (
                      <span
                        key={part.key}
                        className={part.bar}
                        style={{ width: `${(statusCounts[part.key] / statusTotal) * 100}%` }}
                      />
                    ) : null,
                  )}
              </div>
              <ul className="mt-4 space-y-2.5">
                {STATUS_PARTS.map((part) => (
                  <li key={part.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <part.icon size={16} className={part.text} /> {part.label}
                    </span>
                    <span className="font-bold text-slate-900">{statusCounts[part.key]}</span>
                  </li>
                ))}
              </ul>
              {stats.canais && (
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-sm">
                  {(
                    [
                      ["Site", Globe, stats.canais.site],
                      ["Balcão", Store, stats.canais.balcao],
                    ] as const
                  ).map(([label, Icon, c]) => (
                    <div key={label} className="rounded-xl bg-blue-50/60 p-3">
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Icon size={13} className="text-brand" /> Vendas no {label.toLowerCase()}
                      </p>
                      <p className="font-display text-slate-900">{centsToBRL(c.vendasCents)}</p>
                      <p className="text-[11px] text-slate-500">
                        {c.pedidos} {c.pedidos === 1 ? "venda" : "vendas"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card p-5">
              <h2 className="font-display mb-1 text-lg text-slate-900">Agora</h2>
              <p className="mb-3 text-xs text-slate-500">Sempre atual, independente do período escolhido</p>
              <div className="divide-y divide-slate-100">
                {quick.map(([label, period]) => (
                  <div key={label} className="flex items-center justify-between py-2.5">
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <CalendarDays size={15} className="text-brand" /> {label}
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold text-slate-900">{centsToBRL(period.vendasCents)}</span>
                      <span className="block text-[11px] text-slate-500">lucro {centsToBRL(period.lucroCents)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <section id="top-produtos" className="card mt-5 scroll-mt-24 p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display flex items-center gap-2 text-lg text-slate-900">
              <Trophy size={18} className="text-brand" /> Mais vendidos
            </h2>
            {stats.topProducts.length > 0 && (
              <span className="text-xs text-slate-500">
                {stats.topProducts.length} {stats.topProducts.length === 1 ? "produto" : "produtos"}
              </span>
            )}
          </div>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma venda nesse período.</p>
          ) : (
            <>
              <ol className="space-y-3">
                {productsShown.map((p, i) => {
                  const rank = productOffset + i + 1;
                  return (
                    <li key={p.name + rank} className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                          rank === 1 ? "bg-brand text-white shadow-brand" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                          <p className="shrink-0 text-sm font-bold text-slate-900">{centsToBRL(p.receitaCents)}</p>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${topReceita > 0 ? (p.receitaCents / topReceita) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {p.quantity} {p.quantity === 1 ? "unidade" : "unidades"} · lucro {centsToBRL(p.lucroCents)} ·
                          margem {p.margemPercent.toFixed(1)}%
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <Pagination
                page={productPage}
                totalPages={productPages}
                onChange={setProductPage}
                scrollTarget="top-produtos"
                compact
              />
            </>
          )}
        </section>

        <p className="mt-5 text-xs text-slate-400">
          Conta só pedidos pagos. Lucro = preço de venda − custo do produto + taxa de serviço (o frete vai direto pro
          entregador e a tarifa do Mercado Pago não entra). Datas no horário de Brasília.
        </p>
      </div>
    </div>
  );
}
