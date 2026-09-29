"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { Loader } from "@/components/ui/Loader";
import type { MercadoPagoDiagnostics } from "@/lib/mercadopago";

function Row({ ok, title, children }: { ok: boolean | null; title: string; children?: React.ReactNode }) {
  const Icon = ok == null ? CircleAlert : ok ? CheckCircle2 : XCircle;
  const color = ok == null ? "text-amber-600" : ok ? "text-green-600" : "text-red-600";
  return (
    <li className="flex gap-3 rounded-xl border border-blue-50 bg-white p-3">
      <Icon size={20} className={`mt-0.5 shrink-0 ${color}`} />
      <div className="text-sm">
        <p className="text-slate-900">{title}</p>
        {children && <div className="mt-0.5 text-slate-600">{children}</div>}
      </div>
    </li>
  );
}

/** Confere de qual conta é o token do Mercado Pago e se ela pode receber Pix. */
export function MercadoPagoCheck() {
  const [result, setResult] = useState<MercadoPagoDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    try {
      setResult(await adminApi<MercadoPagoDiagnostics>("mpDiagnostics"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Confere direto no Mercado Pago de qual conta é o Access Token configurado na Vercel e se essa conta pode
        receber Pix. O dinheiro das vendas cai nessa conta.
      </p>
      <button type="button" className="btn-primary" onClick={check} disabled={loading}>
        {loading ? <Loader size={18} color="#fff" /> : "Verificar Mercado Pago"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <ul className="space-y-2">
          <Row ok={result.tokenType === "produção"} title={`Token de ${result.tokenType}`}>
            {result.tokenType !== "produção" && (
              <>
                Esse token é da aba <b>Teste</b>: o Pix gerado não existe de verdade (o banco diz “chave não encontrada”).
                No painel do Mercado Pago, abra a aplicação → Credenciais → aba <b>Produção</b>, copie o Access Token de
                lá, troque o <code>MERCADOPAGO_ACCESS_TOKEN</code> na Vercel e faça Redeploy.
              </>
            )}
          </Row>
          <Row ok={result.account != null} title="Conta dona do token">
            {result.account ? (
              <>
                <b>{result.account.email ?? "e-mail não informado"}</b>
                {result.account.nickname ? ` · ${result.account.nickname}` : ""} · nº {result.account.id}
                <br />
                Essa tem que ser a conta da loja, a mesma que tem a chave Pix.
              </>
            ) : (
              `Não foi possível identificar (${result.accountError ?? "sem resposta"}).`
            )}
          </Row>
          <Row ok={result.pixAvailable} title={result.pixAvailable ? "Pix disponível nessa conta" : "Pix NÃO disponível nessa conta"}>
            {result.pixAvailable === false && (
              <>
                O Mercado Pago não oferece Pix pra essa conta. Cadastre uma chave Pix <b>nessa mesma conta</b> (app Mercado
                Pago → Pix → Minhas chaves) ou use o token da conta que já tem a chave. Meios liberados hoje:{" "}
                {result.methods.join(", ") || "nenhum"}.
              </>
            )}
            {result.pixAvailable == null && "Não deu pra consultar os meios de pagamento."}
          </Row>
        </ul>
      )}
    </div>
  );
}
