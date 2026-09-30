"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, MessageCircle, RefreshCw, Send } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { HelpTip } from "@/components/ui/HelpTip";
import { Loader } from "@/components/ui/Loader";

type WaStatus =
  | { configured: false }
  | {
      configured: true;
      qrUrl: string | null;
      status?: string;
      number?: string | null;
      persistent?: boolean | null;
      lastDisconnect?: { code: number | null; reason: string; at: string } | null;
      error?: string;
    };

const STATUS_TEXT: Record<string, { label: string; tone: string }> = {
  conectado: { label: "Conectado", tone: "bg-green-100 text-green-700" },
  aguardando_qr: { label: "Esperando ler o QR code", tone: "bg-amber-100 text-amber-800" },
  reconectando: { label: "Reconectando...", tone: "bg-slate-100 text-slate-600" },
  iniciando: { label: "Iniciando...", tone: "bg-slate-100 text-slate-600" },
};

/** Avisos de pedido pago no WhatsApp da loja (enviados do WhatsApp conectado por QR). */
export function WhatsappAlertCard({ number, onChange }: { number: string; onChange: (value: string) => void }) {
  const [info, setInfo] = useState<WaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setInfo(await adminApi<WaStatus>("whatsappStatus"));
    } catch (err) {
      setInfo({ configured: true, qrUrl: null, error: err instanceof Error ? err.message : "Erro ao consultar." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function sendTest() {
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      await adminApi("sendTestWhatsapp", { to: number });
      setMessage("Mensagem de teste enviada! Confira o WhatsApp da loja.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  const statusInfo = info && info.configured && info.status ? STATUS_TEXT[info.status] : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Quando um pedido é pago, o WhatsApp conectado (o particular do dono) manda uma mensagem pro WhatsApp da loja
        com o número do pedido, os produtos, o endereço e o contato do cliente.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
        <MessageCircle size={18} className="text-green-600" />
        {loading ? (
          <Loader size={16} />
        ) : !info?.configured ? (
          <span className="text-sm text-amber-800">
            Serviço de WhatsApp ainda não configurado (faltam as variáveis na Vercel).
          </span>
        ) : info.error ? (
          <span className="text-sm text-red-600">{info.error}</span>
        ) : (
          <>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${statusInfo?.tone ?? "bg-slate-100 text-slate-600"}`}>
              {statusInfo?.label ?? info.status}
            </span>
            {info.status === "conectado" && info.number && (
              <span className="text-sm text-slate-700">enviando de +{info.number}</span>
            )}
          </>
        )}
        {info?.configured && !info.error && info.status !== "conectado" && info.lastDisconnect && (
          <p className="w-full text-xs text-slate-500 sm:order-last">
            Última desconexão ({new Date(info.lastDisconnect.at).toLocaleString("pt-BR")}): {info.lastDisconnect.reason}
          </p>
        )}
        {info?.configured && info.persistent === false && (
          <p className="w-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:order-last">
            A sessão do WhatsApp não está salva num volume no Railway, então todo reinício pede o QR de novo. No
            Railway, crie um volume em /data no serviço e coloque a variável AUTH_DIR=/data/auth.
          </p>
        )}
        <div className="ml-auto flex gap-2">
          {info?.configured && info.qrUrl && info.status !== "conectado" && (
            <a href={info.qrUrl} target="_blank" rel="noopener noreferrer" className="btn-primary px-3 py-2 text-sm">
              <ExternalLink size={14} /> Abrir QR code
            </a>
          )}
          <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-800">
          WhatsApp da loja (recebe os avisos)
          <HelpTip text="Número que recebe a mensagem a cada pedido pago. Coloque com DDD, ex.: 35999998888. Salve as configurações depois de mudar." />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input sm:max-w-xs"
            inputMode="tel"
            placeholder="35999998888"
            value={number}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary whitespace-nowrap"
            onClick={sendTest}
            disabled={sending || number.replace(/\D/g, "").length < 10}
          >
            {sending ? <Loader size={16} /> : <Send size={16} />} Enviar teste
          </button>
        </div>
        {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
