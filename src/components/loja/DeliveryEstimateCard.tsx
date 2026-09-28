"use client";

import { useState } from "react";
import { Bike, MapPin, TriangleAlert } from "lucide-react";
import { centsToBRL } from "@/lib/money";

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

type Result =
  | { kind: "success"; zoneName: string; city: string; totalCents: number }
  | { kind: "error"; message: string };

export function DeliveryEstimateCard() {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleCalculate() {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setResult({ kind: "error", message: "Digite um CEP válido (8 números)." });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/shipping/estimate-by-cep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep: digits }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ kind: "error", message: data.error ?? "Não foi possível calcular a entrega." });
        return;
      }
      setResult({
        kind: "success",
        zoneName: data.zoneName,
        city: data.city,
        totalCents: data.breakdown.totalCents,
      });
    } catch {
      setResult({ kind: "error", message: "Erro de conexão. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex items-center gap-2 font-display text-slate-900">
        <Bike size={20} className="text-brand" />
        Informações de Entrega
      </div>
      <p className="mt-1 text-sm text-slate-600">
        <span className="font-medium">Serviço:</span> Entrega expressa (moto)
      </p>

      <label className="mt-4 flex items-center gap-1 text-sm font-medium text-slate-700">
        <MapPin size={14} className="text-brand" />
        Informe seu CEP para calcular a entrega:
      </label>
      <div className="mt-2 flex gap-2">
        <input
          className="input"
          placeholder="00000-000"
          value={cep}
          inputMode="numeric"
          onChange={(e) => setCep(formatCep(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
        />
        <button
          type="button"
          className="btn-primary whitespace-nowrap px-4"
          onClick={handleCalculate}
          disabled={loading}
        >
          {loading ? "Calculando..." : "Calcular"}
        </button>
      </div>

      {result?.kind === "success" && (
        <p className="mt-3 text-sm font-medium text-slate-700">
          Entrega estimada pra {result.city} ({result.zoneName}):{" "}
          <span className="font-display text-brand">{centsToBRL(result.totalCents)}</span>
        </p>
      )}
      {result?.kind === "error" && <p className="mt-3 text-sm text-red-600">{result.message}</p>}

      <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <p>
          <span className="font-bold">IMPORTANTE:</span> o valor exibido acima é uma{" "}
          <span className="font-bold">estimativa aproximada</span> da taxa de entrega. O valor final pode
          variar e será <span className="font-bold">pago diretamente ao entregador</span> no momento da
          entrega. O pagamento neste site é <span className="font-bold">só do produto</span> (o frete não
          entra na cobrança online).
        </p>
      </div>
    </div>
  );
}
