"use client";

/**
 * Google reCAPTCHA v3 (invisível): não tem quadradinho pra marcar, o Google
 * dá uma nota de "parece humano" e o servidor confere (lib/recaptchaServer).
 * Sem NEXT_PUBLIC_RECAPTCHA_SITE_KEY tudo aqui vira no-op.
 */

type Grecaptcha = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, opts: { action: string }) => Promise<string>;
};

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (!SITE_KEY) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Não foi possível carregar o reCAPTCHA."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Começa a carregar o script já ao abrir a página (o envio fica mais rápido). */
export function preloadRecaptcha() {
  loadScript().catch(() => {});
}

/** Token pra mandar junto do formulário. `null` se o reCAPTCHA não estiver configurado ou falhar. */
export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (!SITE_KEY) return null;
  try {
    await loadScript();
    const g = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
    if (!g) return null;
    return await new Promise<string | null>((resolve) => {
      g.ready(() => {
        g.execute(SITE_KEY, { action }).then(resolve, () => resolve(null));
      });
    });
  } catch {
    return null;
  }
}
