"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MapPin, Sparkles } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { centsToBRL } from "@/lib/money";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { formatCep } from "@/components/account/AddressFields";
import { HelpTip } from "@/components/ui/HelpTip";
import { Loader } from "@/components/ui/Loader";
import type { SiteSettings } from "@/lib/types";
import type { PricingSuggestion } from "@/lib/geo";

type FreightFields = Pick<
  SiteSettings,
  | "origin_cep"
  | "origin_address"
  | "origin_lat"
  | "origin_lng"
  | "shipping_base_fee_cents"
  | "shipping_per_km_cents"
  | "shipping_max_km"
>;

const FIELDS: (keyof FreightFields)[] = [
  "origin_cep",
  "origin_address",
  "origin_lat",
  "origin_lng",
  "shipping_base_fee_cents",
  "shipping_per_km_cents",
  "shipping_max_km",
];

function reaisToCents(value: string) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function FreightSettings() {
  const [data, setData] = useState<FreightFields>(DEFAULT_SETTINGS);
  const [baseFee, setBaseFee] = useState("");
  const [perKm, setPerKm] = useState("");
  const [locating, setLocating] = useState(false);
  const [suggestion, setSuggestion] = useState<(PricingSuggestion & { city: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi<{ settings: { key: string; value: unknown }[] }>("getSettings").then(({ settings }) => {
      const merged = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
      for (const row of settings) merged[row.key] = row.value;
      const next = merged as unknown as FreightFields;
      setData(next);
      setBaseFee((next.shipping_base_fee_cents / 100).toFixed(2).replace(".", ","));
      setPerKm((next.shipping_per_km_cents / 100).toFixed(2).replace(".", ","));
      setLoaded(true);
    });
  }, []);

  async function handleLocate() {
    setLocating(true);
    setError(null);
    setMessage(null);
    try {
      const place = await adminApi<{
        address: string;
        city: string;
        lat: number;
        lng: number;
        suggestion: PricingSuggestion;
      }>("locateStoreCep", { cep: data.origin_cep });
      // Já preenche os preços com os valores típicos pro porte da cidade.
      const s = place.suggestion;
      setData((d) => ({
        ...d,
        origin_address: place.address,
        origin_lat: place.lat,
        origin_lng: place.lng,
        shipping_max_km: s.maxKm,
      }));
      setBaseFee((s.baseFeeCents / 100).toFixed(2).replace(".", ","));
      setPerKm((s.perKmCents / 100).toFixed(2).replace(".", ","));
      setSuggestion({ ...s, city: place.city });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível localizar o CEP.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (data.origin_lat == null) {
      setError("Localize o CEP da loja antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      const fields = {
        ...data,
        shipping_base_fee_cents: reaisToCents(baseFee),
        shipping_per_km_cents: reaisToCents(perKm),
      };
      await adminApi("saveSettings", {
        fields: Object.fromEntries(FIELDS.map((key) => [key, fields[key]])),
      });
      setData(fields);
      setMessage("Frete salvo! As estimativas da loja já usam esses valores.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex justify-center py-16">
        <Loader />
      </div>
    );
  }

  const exampleFee = (km: number) => reaisToCents(baseFee) + Math.round(km * reaisToCents(perKm));

  return (
    <div>
      <h1 className="font-display mb-1 text-2xl text-slate-900">Frete</h1>
      <p className="mb-6 text-sm text-slate-500">
        O cliente digita o CEP e o site estima o frete pela distância até a loja. O frete é pago direto ao
        entregador — não entra no valor cobrado no site.
      </p>

      <form onSubmit={handleSave} className="space-y-6">
        <section className="card p-5">
          <h2 className="font-display mb-3 text-lg text-slate-900">1. Onde fica a loja</h2>
          <label className="mb-1 block text-xs text-slate-500">
            CEP da loja
            <HelpTip text="É o ponto de partida das entregas. O site calcula a distância desse CEP até o CEP do cliente." />
          </label>
          <div className="flex gap-2 sm:max-w-sm">
            <input
              className="input"
              placeholder="00000-000"
              inputMode="numeric"
              value={data.origin_cep ?? ""}
              onChange={(e) =>
                setData({ ...data, origin_cep: formatCep(e.target.value), origin_lat: null, origin_lng: null })
              }
            />
            <button
              type="button"
              className="btn-secondary whitespace-nowrap"
              onClick={handleLocate}
              disabled={locating || (data.origin_cep ?? "").replace(/\D/g, "").length !== 8}
            >
              {locating ? <Loader size={16} /> : <MapPin size={16} />} Localizar
            </button>
          </div>
          {data.origin_lat != null ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle2 size={16} /> {data.origin_address || "Loja localizada no mapa"}
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-700">Digite o CEP e clique em Localizar.</p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-display mb-3 text-lg text-slate-900">2. Quanto cobrar</h2>
          {suggestion && (
            <p className="mb-4 flex gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-slate-700">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-brand" />
              <span>
                Preenchemos com valores típicos de entrega por moto pra {suggestion.city} ({suggestion.tier}
                {suggestion.population ? `, ~${Math.round(suggestion.population / 1000)} mil habitantes` : ""}).
                É um ponto de partida — ajuste conforme o que os motoboys cobram aí e clique em Salvar.
              </span>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Taxa base (R$)
                <HelpTip text="Valor que toda entrega tem, mesmo bem pertinho." />
              </label>
              <input className="input" inputMode="decimal" value={baseFee} onChange={(e) => setBaseFee(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Valor por km (R$)
                <HelpTip text="Somado à taxa base pra cada km de distância até o cliente." />
              </label>
              <input className="input" inputMode="decimal" value={perKm} onChange={(e) => setPerKm(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Entrega até (km)
                <HelpTip text="Clientes mais longe que isso veem que a loja não entrega no endereço e não conseguem fechar o pedido. Use 0 pra não ter limite." />
              </label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.5"
                value={data.shipping_max_km}
                onChange={(e) => setData({ ...data, shipping_max_km: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-blue-50/60 p-4 text-sm">
            <p className="mb-2 text-slate-700">Exemplos de como o cliente vai ver:</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[2, 5, 10].map((km) => (
                <div key={km} className="rounded-lg bg-white p-2">
                  <p className="text-xs text-slate-500">{km} km</p>
                  <p className="text-brand">
                    {data.shipping_max_km > 0 && km > data.shipping_max_km ? "Não entrega" : centsToBRL(exampleFee(km))}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              A distância é estimada pelo mapa (um pouco acima da linha reta, pra aproximar o caminho pelas ruas).
            </p>
          </div>
        </section>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Loader size={18} color="#fff" /> : "Salvar frete"}
        </button>
      </form>
    </div>
  );
}
