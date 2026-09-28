"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, ExternalLink, Timer } from "lucide-react";
import { centsToBRL } from "@/lib/money";
import type { Order } from "@/lib/types";

function useSecondsLeft(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

/** QR code, Pix copia e cola, link de pagamento e cronômetro do pedido aguardando pagamento. */
export function PixPaymentPanel({
  order,
}: {
  order: Pick<Order, "total_cents" | "pix_qr_code" | "payment_url" | "payment_expires_at">;
}) {
  const secondsLeft = useSecondsLeft(order.payment_expires_at);
  const expired = secondsLeft === 0;
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!order.pix_qr_code) return;
    QRCode.toDataURL(order.pix_qr_code, { width: 440, margin: 1 })
      .then(setQrImage)
      .catch(() => setQrImage(null));
  }, [order.pix_qr_code]);

  async function copyCode() {
    if (!order.pix_qr_code) return;
    try {
      await navigator.clipboard.writeText(order.pix_qr_code);
    } catch {
      // Navegadores sem clipboard API: seleciona o texto pra copiar na mão.
      const el = document.getElementById("pix-copia-e-cola") as HTMLTextAreaElement | null;
      el?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (expired) {
    return (
      <div className="card mb-4 border border-red-100 p-5 text-center">
        <p className="font-display text-lg text-red-700">Tempo pra pagamento esgotado</p>
        <p className="mt-1 text-sm text-slate-600">
          O pedido vai ser cancelado e os itens voltam pro estoque. Se ainda quiser, é só montar o carrinho e pedir de
          novo.
        </p>
      </div>
    );
  }

  const minutes = secondsLeft != null ? String(Math.floor(secondsLeft / 60)).padStart(2, "0") : null;
  const seconds = secondsLeft != null ? String(secondsLeft % 60).padStart(2, "0") : null;
  const urgent = secondsLeft != null && secondsLeft < 5 * 60;

  return (
    <div className="card mb-4 overflow-hidden border border-blue-100">
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-white"
        style={{ background: "linear-gradient(135deg, #2563eb, #0f2f8f)" }}
      >
        <div>
          <p className="font-display text-lg">Pague com Pix</p>
          <p className="text-sm text-blue-100">Total: {centsToBRL(order.total_cents)}</p>
        </div>
        {minutes && (
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-2 ${urgent ? "bg-red-500/90" : "bg-white/15"}`}
            aria-live="polite"
          >
            <Timer size={18} />
            <span className="font-display text-2xl tabular-nums">
              {minutes}:{seconds}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[220px_1fr] sm:items-center">
        {order.pix_qr_code ? (
          <div className="mx-auto w-full max-w-[220px] rounded-2xl border border-blue-100 bg-white p-2">
            {qrImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImage} alt="QR code do Pix" className="h-auto w-full" />
            ) : (
              <div className="aspect-square w-full animate-pulse rounded-xl bg-slate-100" />
            )}
          </div>
        ) : null}

        <div className={order.pix_qr_code ? "" : "sm:col-span-2"}>
          {order.pix_qr_code && (
            <>
              <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                <li>Abra o app do seu banco e escolha pagar com Pix.</li>
                <li>Aponte a câmera pro QR code ou use o copia e cola.</li>
                <li>Confirme o pagamento. Pronto!</li>
              </ol>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="pix-copia-e-cola">
                Pix copia e cola
              </label>
              <textarea
                id="pix-copia-e-cola"
                readOnly
                rows={2}
                value={order.pix_qr_code}
                className="input resize-none font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className="btn-primary mt-2 w-full" onClick={copyCode}>
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? "Código copiado!" : "Copiar código Pix"}
              </button>
            </>
          )}
          {order.payment_url && (
            <a
              href={order.payment_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${order.pix_qr_code ? "btn-secondary" : "btn-primary"} mt-2 w-full`}
            >
              <ExternalLink size={16} /> {order.pix_qr_code ? "Abrir página de pagamento" : "Pagar agora"}
            </a>
          )}
        </div>
      </div>

      <p className="border-t border-blue-50 bg-blue-50/40 px-5 py-3 text-xs text-slate-600">
        Seu pedido fica reservado até o fim do cronômetro. Assim que o pagamento for aprovado, esta página atualiza
        sozinha e você recebe a confirmação por e-mail.
      </p>
    </div>
  );
}
