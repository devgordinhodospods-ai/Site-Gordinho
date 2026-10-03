"use client";

import { Bike, TriangleAlert } from "lucide-react";
import { FreightEstimator } from "@/components/loja/FreightEstimator";

export function DeliveryInfoCard() {
  return (
    <div className="card border border-blue-100 bg-blue-50/40 p-4">
      <div className="font-display flex items-center gap-2 text-slate-900">
        <Bike size={20} className="text-brand" />
        Informações de entrega
      </div>
      <p className="mt-1 text-sm text-slate-600">Entrega por motoboy</p>

      <div className="mt-4">
        <FreightEstimator />
      </div>

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
