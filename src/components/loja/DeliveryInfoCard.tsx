"use client";

import { useState } from "react";
import { Bike, MapPin, TriangleAlert } from "lucide-react";
import { centsToBRL } from "@/lib/money";
import { formatCep } from "@/components/account/AddressFields";
import type { FreightEstimate } from "@/lib/geo";

export function DeliveryInfoCard() {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<FreightEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCalculate() {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setError("Digite um CEP válido (8 números).");
      return;
    }
    setLoading(true);
    setError(null);
    setEstimate(null);
    try {
      const res = await fetch(`/api/frete/estimativa?cep=${digits}`);
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Não foi possível calcular.");
      else setEstimate(data.estimate);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card border border-blue-100 bg-blue-50/40 p-4">
      <div className="font-display flex items-center gap-2 text-slate-900">
        <Bike size={20} className="text-brand" />
        Informações de entrega
      </div>
      <p className="mt-1 text-sm text-slate-600">Entrega por motoboy</p>

      <label className="mt-4 flex items-center gap-1 text-sm text-slate-700">
        <MapPin size={14} className="text-brand" />
        Informe seu CEP para estimar o frete:
      </label>
      <div className="mt-2 flex gap-2">
        <input
          className="input"
          placeholder="00000-000"
          inputMode="numeric"
          value={cep}
          onChange={(e) => setCep(formatCep(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
        />
        <button type="button" className="btn-primary whitespace-nowrap px-4" onClick={handleCalculate} disabled={loading}>
          {loading ? "Calculando..." : "Calcular"}
        </button>
      </div>

      {estimate?.status === "ok" && (
        <p className="mt-3 text-sm text-slate-700">
          Entrega estimada pra {estimate.city} (~{estimate.km} km):{" "}
          <span className="font-display text-brand">{centsToBRL(estimate.feeCents)}</span>
        </p>
      )}
      {estimate?.status === "out_of_range" && (
        <p className="mt-3 text-sm text-red-600">
          Ainda não entregamos em {estimate.city} ({estimate.km} km da loja — atendemos até {estimate.maxKm} km).
        </p>
      )}
      {estimate?.status === "unavailable" && (
        <p className="mt-3 text-sm text-slate-600">
          Não conseguimos estimar pra esse CEP — o valor é combinado com o entregador.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <p>
          <span className="font-bold">IMPORTANTE:</span> o valor é uma{" "}
          <span className="font-bold">estimativa aproximada</span>. O frete é pago{" "}
          <span className="font-bold">direto ao entregador</span> na hora da entrega — no site você paga só os
          produtos.
        </p>
      </div>
    </div>
  );
}
