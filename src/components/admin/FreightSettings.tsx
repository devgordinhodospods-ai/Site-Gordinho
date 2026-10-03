"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MapPin, Plus, Sparkles, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { centsToBRL } from "@/lib/money";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { formatCep } from "@/components/account/AddressFields";
import { HelpTip } from "@/components/ui/HelpTip";
import { Loader } from "@/components/ui/Loader";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { ShippingRegion, SiteSettings } from "@/lib/types";
import type { PricingSuggestion } from "@/lib/geo";

/** Região em edição: preços como texto ("8,50") e a sugestão do último "Localizar". */
type RegionDraft = ShippingRegion & {
  baseFee: string;
  perKm: string;
  suggestion?: PricingSuggestion & { city: string };
  locating?: boolean;
  error?: string | null;
};

function reaisToCents(value: string) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function centsToReais(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function toDraft(r: ShippingRegion): RegionDraft {
  return { ...r, baseFee: centsToReais(r.base_fee_cents), perKm: centsToReais(r.per_km_cents) };
}

function emptyRegion(): RegionDraft {
  return toDraft({
    id: newId(),
    name: "",
    cep: "",
    address: null,
    lat: null,
    lng: null,
    base_fee_cents: DEFAULT_SETTINGS.shipping_base_fee_cents,
    per_km_cents: DEFAULT_SETTINGS.shipping_per_km_cents,
    max_km: DEFAULT_SETTINGS.shipping_max_km,
  });
}

export function FreightSettings() {
  const [regions, setRegions] = useState<RegionDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    adminApi<{ settings: { key: string; value: unknown }[] }>("getSettings").then(({ settings }) => {
      const merged = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
      for (const row of settings) merged[row.key] = row.value;
      const s = merged as unknown as SiteSettings;
      const saved = Array.isArray(s.shipping_regions) ? s.shipping_regions : [];
      if (saved.length > 0) {
        setRegions(saved.map(toDraft));
      } else if (s.origin_lat != null) {
        // Loja de antes das regiões: o ponto único vira a 1ª região.
        setRegions([
          toDraft({
            id: newId(),
            name: "",
            cep: s.origin_cep ?? "",
            address: s.origin_address,
            lat: s.origin_lat,
            lng: s.origin_lng,
            base_fee_cents: s.shipping_base_fee_cents,
            per_km_cents: s.shipping_per_km_cents,
            max_km: s.shipping_max_km,
          }),
        ]);
      } else {
        setRegions([emptyRegion()]);
      }
      setLoaded(true);
    });
  }, []);

  function update(id: string, patch: Partial<RegionDraft>) {
    setRegions((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function locate(region: RegionDraft) {
    update(region.id, { locating: true, error: null });
    setMessage(null);
    try {
      const place = await adminApi<{
        address: string;
        city: string;
        lat: number;
        lng: number;
        suggestion: PricingSuggestion;
      }>("locateStoreCep", { cep: region.cep });
      // Já preenche os preços com os valores típicos pro porte da cidade.
      const s = place.suggestion;
      update(region.id, {
        locating: false,
        name: region.name.trim() || place.city,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        max_km: s.maxKm,
        baseFee: centsToReais(s.baseFeeCents),
        perKm: centsToReais(s.perKmCents),
        suggestion: { ...s, city: place.city },
      });
    } catch (err) {
      update(region.id, {
        locating: false,
        error: err instanceof Error ? err.message : "Não foi possível localizar o CEP.",
      });
    }
  }

  async function removeRegion(region: RegionDraft) {
    const ok = await confirm(`As estimativas de frete deixam de usar a região ${region.name || "sem nome"}.`, {
      title: "Remover região?",
      confirmLabel: "Remover",
    });
    if (ok) setRegions((list) => list.filter((r) => r.id !== region.id));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const missing = regions.find((r) => r.lat == null || r.lng == null);
    if (missing) {
      setError(`Localize o CEP da região ${missing.name || "sem nome"} antes de salvar (botão Localizar).`);
      return;
    }
    if (regions.length === 0) {
      setError("Adicione pelo menos uma região de entrega.");
      return;
    }
    const clean: ShippingRegion[] = regions.map((r) => ({
      id: r.id,
      name: r.name.trim(),
      cep: r.cep,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      base_fee_cents: reaisToCents(r.baseFee),
      per_km_cents: reaisToCents(r.perKm),
      max_km: Number(r.max_km) || 0,
    }));
    const first = clean[0];
    setSaving(true);
    try {
      await adminApi("saveSettings", {
        fields: {
          shipping_regions: clean,
          // Campos antigos espelham a 1ª região (compatibilidade).
          origin_cep: first.cep,
          origin_address: first.address,
          origin_lat: first.lat,
          origin_lng: first.lng,
          shipping_base_fee_cents: first.base_fee_cents,
          shipping_per_km_cents: first.per_km_cents,
          shipping_max_km: first.max_km,
        },
      });
      setRegions(clean.map(toDraft));
      setMessage("Frete salvo! As estimativas da loja já usam essas regiões.");
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

  return (
    <div>
      <h1 className="font-display mb-1 text-2xl text-slate-900">Frete</h1>
      <p className="mb-6 text-sm text-slate-500">
        Cadastre uma região pra cada cidade/ponto de onde saem as entregas. Quando o cliente digita o CEP, o site
        usa a região <strong>mais perto dele</strong> e os preços dela. O frete é pago direto ao entregador — não
        entra no valor cobrado no site.
      </p>

      <form onSubmit={handleSave} className="space-y-5">
        {regions.map((region, index) => {
          const exampleFee = (km: number) => reaisToCents(region.baseFee) + Math.round(km * reaisToCents(region.perKm));
          return (
            <section key={region.id} className="card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display flex items-center gap-2 text-lg text-slate-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-white">
                    {index + 1}
                  </span>
                  {region.name.trim() || "Nova região"}
                </h2>
                {regions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRegion(region)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={15} /> Remover
                  </button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    Nome da região
                    <HelpTip text="Só pra você se organizar e pro cliente ver de onde sai a entrega. Ex.: Lavras, Perdões." />
                  </label>
                  <input
                    className="input"
                    placeholder="Ex.: Lavras"
                    value={region.name}
                    onChange={(e) => update(region.id, { name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    CEP de onde sai a entrega
                    <HelpTip text="Ponto de partida das entregas dessa região. O site calcula a distância desse CEP até o CEP do cliente." />
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="input"
                      placeholder="00000-000"
                      inputMode="numeric"
                      value={region.cep}
                      onChange={(e) =>
                        update(region.id, { cep: formatCep(e.target.value), lat: null, lng: null, address: null })
                      }
                    />
                    <button
                      type="button"
                      className="btn-secondary whitespace-nowrap"
                      onClick={() => locate(region)}
                      disabled={region.locating || region.cep.replace(/\D/g, "").length !== 8}
                    >
                      {region.locating ? <Loader size={16} /> : <MapPin size={16} />} Localizar
                    </button>
                  </div>
                </div>
              </div>
              {region.error ? (
                <p className="mt-2 text-sm text-red-600">{region.error}</p>
              ) : region.lat != null ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle2 size={16} /> {region.address || "Localizado no mapa"}
                </p>
              ) : (
                <p className="mt-2 text-sm text-amber-700">Digite o CEP e clique em Localizar.</p>
              )}

              {region.suggestion && (
                <p className="mt-4 flex gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-slate-700">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-brand" />
                  <span>
                    Preenchemos com valores típicos de entrega por moto pra {region.suggestion.city} (
                    {region.suggestion.tier}
                    {region.suggestion.population
                      ? `, ~${Math.round(region.suggestion.population / 1000)} mil habitantes`
                      : ""}
                    ). Ajuste conforme o que os motoboys cobram aí.
                  </span>
                </p>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    Taxa base (R$)
                    <HelpTip text="Valor que toda entrega dessa região tem, mesmo bem pertinho." />
                  </label>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={region.baseFee}
                    onChange={(e) => update(region.id, { baseFee: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    Valor por km (R$)
                    <HelpTip text="Somado à taxa base pra cada km de distância até o cliente." />
                  </label>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={region.perKm}
                    onChange={(e) => update(region.id, { perKm: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    Entrega até (km)
                    <HelpTip text="Até quantos km dessa região a loja entrega. Cliente mais longe de todas as regiões vê que a loja não entrega no endereço. Use 0 pra não ter limite." />
                  </label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="0.5"
                    value={region.max_km}
                    onChange={(e) => update(region.id, { max_km: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-blue-50/60 p-3 text-center text-sm">
                {[2, 5, 10].map((km) => (
                  <div key={km} className="rounded-lg bg-white p-2">
                    <p className="text-xs text-slate-500">{km} km</p>
                    <p className="text-brand">
                      {region.max_km > 0 && km > region.max_km ? "Não entrega" : centsToBRL(exampleFee(km))}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <button
          type="button"
          className="btn-secondary w-full border-dashed"
          onClick={() => setRegions((list) => [...list, emptyRegion()])}
        >
          <Plus size={16} /> Adicionar região
        </button>

        <p className="text-xs text-slate-500">
          A distância é estimada pelo mapa (um pouco acima da linha reta, pra aproximar o caminho pelas ruas).
        </p>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Loader size={18} color="#fff" /> : "Salvar frete"}
        </button>
      </form>
      {dialog}
    </div>
  );
}
