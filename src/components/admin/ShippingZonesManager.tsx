"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { brlToCents, centsToBRL } from "@/lib/money";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { HelpTip } from "@/components/ui/HelpTip";
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
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Nome da região
            <HelpTip text="Um nome pra você identificar a região (ex: Centro, Zona Norte). Não aparece pro cliente, só organiza aqui no painel." />
          </label>
          <input
            className="input"
            placeholder="Ex: Centro"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Taxa base (R$)
            <HelpTip text="Valor inicial do frete pra essa região. O valor final que o cliente vê pode subir um pouco automaticamente em horário de pico ou chuva no dia." />
          </label>
          <input
            className="input"
            placeholder="0,00"
            required
            inputMode="decimal"
            value={form.base_fee}
            onChange={(e) => setForm({ ...form, base_fee: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Bairros
            <HelpTip text="Lista de bairros dessa região, separados por vírgula. Ajuda só como referência sua — hoje a escolha do cliente na loja é pela região/cidade, não filtra automaticamente por bairro." />
          </label>
          <input
            className="input"
            placeholder="Bairro 1, Bairro 2"
            value={form.neighborhoods}
            onChange={(e) => setForm({ ...form, neighborhoods: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Distância aprox. da loja (km)
            <HelpTip text="Distância dessa região até a loja. Quanto maior, mais caro tende a ficar o frete calculado automaticamente." />
          </label>
          <input
            className="input"
            placeholder="0"
            required
            inputMode="decimal"
            value={form.km_from_origin}
            onChange={(e) => setForm({ ...form, km_from_origin: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Cidades
            <HelpTip text="Lista de cidades dessa região, separadas por vírgula." />
          </label>
          <input
            className="input"
            placeholder="Cidade 1, Cidade 2"
            value={form.cities}
            onChange={(e) => setForm({ ...form, cities: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Ativa
          <HelpTip text="Se desmarcar, essa região some das opções de entrega disponíveis pro cliente no checkout." />
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
