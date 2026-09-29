"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Mail } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { HelpTip } from "@/components/ui/HelpTip";
import { Loader } from "@/components/ui/Loader";

/** Dispara os e-mails de pedido (Pix + pagamento aprovado) com um pedido de exemplo. */
export function EmailTestCard() {
  const { data: session } = useSession();
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const target = to || session?.user?.email || "";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      await adminApi("sendTestEmail", { to: target });
      setMessage(`Enviado pra ${target}! Confira a caixa de entrada (e o spam).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <p className="text-sm text-slate-600">
        Manda pro e-mail abaixo os dois e-mails que o cliente recebe (Pix com QR code e link, e pagamento aprovado),
        usando um pedido de exemplo.
        <HelpTip text="O QR code do teste não é um Pix de verdade. Os e-mails saem pelo Gmail configurado na Vercel (SMTP)." />
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input sm:max-w-sm"
          type="email"
          placeholder={session?.user?.email ?? "seu@email.com"}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button type="submit" className="btn-secondary whitespace-nowrap" disabled={sending || !target}>
          {sending ? <Loader size={16} /> : <Mail size={16} />} Enviar e-mail de teste
        </button>
      </div>
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
