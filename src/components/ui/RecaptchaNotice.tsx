"use client";

import { useEffect } from "react";
import { preloadRecaptcha } from "@/lib/recaptcha";

/**
 * Aviso exigido pelo Google quando o selo flutuante do reCAPTCHA fica
 * escondido (globals.css). Também já carrega o script ao abrir o formulário.
 */
export function RecaptchaNotice({ className = "" }: { className?: string }) {
  useEffect(() => {
    preloadRecaptcha();
  }, []);

  if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) return null;
  return (
    <p className={`text-center text-[11px] leading-snug text-slate-400 ${className}`}>
      Protegido pelo reCAPTCHA do Google —{" "}
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">
        Privacidade
      </a>{" "}
      e{" "}
      <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline">
        Termos
      </a>
      .
    </p>
  );
}
