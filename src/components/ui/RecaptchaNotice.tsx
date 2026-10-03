"use client";

import { useEffect } from "react";
import { preloadRecaptcha } from "@/lib/recaptcha";

/**
 * Carrega o reCAPTCHA ao abrir um formulário protegido (o envio fica mais
 * rápido). O aviso exigido pelo Google é o próprio selo flutuante no canto
 * da tela, que fica visível.
 */
export function RecaptchaNotice(_props: { className?: string }) {
  useEffect(() => {
    preloadRecaptcha();
  }, []);
  return null;
}
