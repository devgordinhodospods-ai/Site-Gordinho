"use client";

import { useState } from "react";
import { Bike, CheckCircle2, PackageCheck } from "lucide-react";
import { Loader } from "@/components/ui/Loader";

/**
 * Card de "saiu pra entrega" com o botão pro cliente confirmar que recebeu
 * (estilo iFood). Pede uma confirmação antes, pra evitar toque sem querer.
 */
export function ConfirmDeliveryCard({ orderId, onConfirmed }: { orderId: string; onConfirmed: () => void }) {
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/pedidos/${orderId}/confirmar-entrega`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível confirmar agora.");
      setAsking(false);
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar agora.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="card mb-4 overflow-hidden border border-blue-100">
        <div
          className="flex items-center gap-4 px-5 py-5 text-white"
          style={{ background: "linear-gradient(135deg, #38bdf8, #0284c7)" }}
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Bike size={28} className="animate-[bikeRide_1.6s_ease-in-out_infinite]" />
          </span>
          <div>
            <p className="font-display text-lg leading-tight">Seu pedido saiu pra entrega!</p>
            <p className="text-sm text-blue-100">O entregador já está a caminho. Lembre: o frete é pago direto a ele.</p>
          </div>
        </div>
        <div className="p-5">
          <p className="mb-3 text-sm text-slate-600">Já recebeu? Confirme aqui pra gente saber que chegou tudo certinho.</p>
          <button type="button" className="btn-primary w-full py-3 text-base" onClick={() => setAsking(true)}>
            <PackageCheck size={20} /> Confirmar entrega
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>

      {asking && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0"
          onClick={() => !sending && setAsking(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm animate-[popIn_.2s_ease-out] rounded-3xl bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
              <CheckCircle2 size={34} />
            </span>
            <h2 className="font-display text-xl text-slate-900">Você recebeu seu pedido?</h2>
            <p className="mt-1 text-sm text-slate-500">Confirme só se o pedido já está com você.</p>
            <button type="button" className="btn-primary mt-5 w-full py-3" onClick={confirm} disabled={sending}>
              {sending ? <Loader size={18} color="#fff" /> : "Sim, recebi"}
            </button>
            <button
              type="button"
              className="btn-secondary mt-2 w-full"
              onClick={() => setAsking(false)}
              disabled={sending}
            >
              Ainda não
            </button>
          </div>
        </div>
      )}
    </>
  );
}
