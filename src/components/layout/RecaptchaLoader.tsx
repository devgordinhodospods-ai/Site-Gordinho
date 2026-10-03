"use client";

import { useEffect } from "react";
import { preloadRecaptcha } from "@/lib/recaptcha";

/**
 * Carrega o reCAPTCHA em todas as páginas (o selo do Google aparece no canto
 * da tela). Espera a página terminar de carregar e o navegador ficar livre,
 * pra não deixar a abertura do site mais lenta.
 */
export function RecaptchaLoader() {
  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback;
      if (idle) idle(() => !cancelled && preloadRecaptcha(), { timeout: 4000 });
      else setTimeout(() => !cancelled && preloadRecaptcha(), 1500);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
    };
  }, []);
  return null;
}
