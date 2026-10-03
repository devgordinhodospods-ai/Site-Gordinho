"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { centsToBRL } from "@/lib/money";
import { formatCep } from "@/components/account/AddressFields";
import type { FreightEstimate } from "@/lib/geo";

const STORAGE_KEY = "frete-cep";

/**
 * Campo de CEP + "Calcular" com a estimativa do frete (pago ao entregador).
 * O último CEP fica salvo no navegador, então produto e carrinho já abrem
 * com ele preenchido.
 */
export function FreightEstimator({ label = "Informe seu CEP para estimar o frete:" }: { label?: string }) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<FreightEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function calculate(value = cep) {
    const digits = value.replace(/\D/g, "");
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
      else {
        setEstimate(data.estimate);
        try {
          localStorage.setItem(STORAGE_KEY, digits);
        } catch {
          // sem armazenamento: só não lembra o CEP
        }
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // Já calcula com o CEP usado da última vez.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (saved && saved.length === 8) {
      setCep(formatCep(saved));
      calculate(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <label className="flex items-center gap-1 text-sm text-slate-700" htmlFor="frete-cep">
        <MapPin size={14} className="text-brand" />
        {label}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="frete-cep"
          className="input"
          placeholder="00000-000"
          inputMode="numeric"
          value={cep}
          onChange={(e) => setCep(formatCep(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              calculate();
            }
          }}
        />
        <button
          type="button"
          className="btn-primary whitespace-nowrap px-4"
          onClick={() => calculate()}
          disabled={loading}
        >
          {loading ? "Calculando..." : "Calcular"}
        </button>
      </div>

      {estimate?.status === "ok" && (
        <p className="mt-3 text-sm text-slate-700">
          Entrega estimada pra {estimate.city} (~{estimate.km} km
          {estimate.region ? ` saindo de ${estimate.region}` : ""}):{" "}
          <span className="font-display text-brand">{centsToBRL(estimate.feeCents)}</span>
        </p>
      )}
      {estimate?.status === "out_of_range" && (
        <p className="mt-3 text-sm text-red-600">
          Ainda não entregamos em {estimate.city} ({estimate.km} km{" "}
          {estimate.region ? `de ${estimate.region}, a região mais perto` : "da loja"} — atendemos até{" "}
          {estimate.maxKm} km).
        </p>
      )}
      {estimate?.status === "unavailable" && (
        <p className="mt-3 text-sm text-slate-600">
          Não conseguimos estimar pra esse CEP — o valor é combinado com o entregador.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
