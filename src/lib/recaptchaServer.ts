/**
 * Confere no Google o token do reCAPTCHA v3 mandado pelo formulário.
 * Sem RECAPTCHA_SECRET_KEY a checagem fica desligada (sempre passa).
 */
export type RecaptchaResult = { ok: true } | { ok: false; error: string };

const BLOCKED = "Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo.";

export function recaptchaEnabled() {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY);
}

export async function verifyRecaptcha(token: unknown, action: string): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { ok: true };
  if (typeof token !== "string" || token.length < 20) return { ok: false, error: BLOCKED };

  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? 0.5);
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean; score?: number; action?: string; "error-codes"?: string[] };
    if (!data.success) {
      // eslint-disable-next-line no-console
      console.warn("[recaptcha] token recusado", action, data["error-codes"]);
      return { ok: false, error: BLOCKED };
    }
    if (data.action && data.action !== action) return { ok: false, error: BLOCKED };
    if (typeof data.score === "number" && data.score < minScore) {
      // eslint-disable-next-line no-console
      console.warn("[recaptcha] nota baixa", action, data.score);
      return { ok: false, error: BLOCKED };
    }
    return { ok: true };
  } catch (err) {
    // Google fora do ar não pode travar as vendas: deixa passar e registra.
    // eslint-disable-next-line no-console
    console.error("[recaptcha] falha ao consultar o Google:", err instanceof Error ? err.message : err);
    return { ok: true };
  }
}
