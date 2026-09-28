"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { brlToCents, centsToBRL } from "@/lib/money";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { ShippingZone } from "@/lib/types";

const EMPTY_FORM = {
  id: "",
  name: "",
  cities: "",
  neighborhoods: "",
  base_fee: "",
  km_from_origin: "",
  active: true,
};

export function ShippingZonesManager() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function load() {
    const { zones } = await adminApi<{ zones: ShippingZone[] }>("listShippingZones");
    setZones(zones);
  }

  useEffect(() => {
    load();
  }, []);

  function edit(zone: ShippingZone) {
    setForm({
      id: zone.id,
      name: zone.name,
      cities: (zone.cities ?? []).join(", "),
      neighborhoods: (zone.neighborhoods ?? []).join(", "),
      base_fee: (zone.base_fee_cents / 100).toString(),
      km_from_origin: zone.km_from_origin.toString(),
      active: zone.active,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi("saveShippingZone", {
        id: form.id || undefined,
        fields: {
          name: form.name,
          cities: form.cities.split(",").map((s) => s.trim()).filter(Boolean),
          neighborhoods: form.neighborhoods.split(",").map((s) => s.trim()).filter(Boolean),
          base_fee_cents: brlToCents(Number(form.base_fee.replace(",", "."))),
          km_from_origin: Number(form.km_from_origin.replace(",", ".")),
          active: form.active,
        },
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar região.");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!(await confirm(`Tem certeza que deseja excluir a região "${name}"? Essa ação não pode ser desfeita.`))) {
      return;
    }
    await adminApi("deleteShippingZone", { id });
    await load();
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Regiões de entrega</h1>
      <p className="mb-6 text-sm text-slate-500">
        Configure a taxa base e a distância aproximada de cada região. O valor final do frete mostrado
        ao cliente varia automaticamente com horário de pico e chuva no local da loja — veja a lógica em{" "}
        <code>src/lib/shipping.ts</code>.
      </p>

      <form onSubmit={handleSubmit} className="card mb-8 grid gap-3 p-4 md:grid-cols-2">
        <input
          className="input"
          placeholder="Nome da região (ex: Centro)"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="input"
          placeholder="Taxa base (R$)"
          required
          inputMode="decimal"
          value={form.base_fee}
          onChange={(e) => setForm({ ...form, base_fee: e.target.value })}
        />
        <input
          className="input"
          placeholder="Bairros (separados por vírgula)"
          value={form.neighborhoods}
          onChange={(e) => setForm({ ...form, neighborhoods: e.target.value })}
        />
        <input
          className="input"
          placeholder="Distância aprox. da loja (km)"
          required
          inputMode="decimal"
          value={form.km_from_origin}
          onChange={(e) => setForm({ ...form, km_from_origin: e.target.value })}
        />
        <input
          className="input md:col-span-2"
          placeholder="Cidades (separadas por vírgula)"
          value={form.cities}
          onChange={(e) => setForm({ ...form, cities: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Ativa
        </label>

        {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}

        <div className="flex gap-2 md:col-span-2">
          <button type="submit" className="btn-primary">
            {form.id ? "Atualizar região" : "Adicionar região"}
          </button>
          {form.id && (
            <button type="button" className="btn-secondary" onClick={() => setForm(EMPTY_FORM)}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {zones.map((z) => (
          <div key={z.id} className="card flex items-center justify-between p-3">
            <div>
              <p className="font-medium">{z.name}</p>
              <p className="text-sm text-slate-500">
                Base: {centsToBRL(z.base_fee_cents)} · {z.km_from_origin} km
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => edit(z)}>
                Editar
              </button>
              <button className="btn-secondary text-red-600" onClick={() => handleDelete(z.id, z.name)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
      {dialog}
    </div>
  );
}
