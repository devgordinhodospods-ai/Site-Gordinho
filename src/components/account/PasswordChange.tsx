"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { Loader } from "@/components/ui/Loader";

type Step = "idle" | "confirmSend" | "enterCode" | "done";

/** "Trocar senha" em Meus dados: código no e-mail (Supabase) + senha nova. */
export function PasswordChange({ email }: { email: string }) {
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("idle");
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  async function sendCode() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/conta/senha/solicitar", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível enviar o código.");
      return;
    }
    setStep("enterCode");
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("As duas senhas não são iguais.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/conta/senha/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, password }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível trocar a senha.");
      return;
    }
    setStep("done");
  }

  if (step === "idle") {
    return (
      <button type="button" className="text-xs font-bold text-brand hover:underline" onClick={() => setStep("confirmSend")}>
        Trocar senha
      </button>
    );
  }

  if (step === "done") {
    return (
      <p className="mt-2 w-full rounded-xl bg-green-50 p-3 text-sm font-medium text-green-700">
        Senha trocada! Use a senha nova no próximo login.{" "}
        <button type="button" className="font-bold underline" onClick={reset}>
          Ok
        </button>
      </p>
    );
  }

  return (
    <div className="mt-2 w-full rounded-xl bg-blue-50/60 p-3">
      {step === "confirmSend" ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1 text-xs font-bold text-slate-600">
            <Lock size={12} /> Trocar senha
          </p>
          <p className="text-sm text-slate-600">
            Vamos mandar um código pra <strong>{email}</strong> pra confirmar que é você.
          </p>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1 py-2 text-sm" onClick={sendCode} disabled={saving}>
              {saving ? <Loader size={16} color="#fff" /> : "Enviar código"}
            </button>
            <button type="button" className="btn-secondary py-2 text-sm" onClick={reset}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={confirm} className="space-y-2">
          <label className="flex items-center gap-1 text-xs font-bold text-slate-600">
            <KeyRound size={12} /> Código enviado para {email}
          </label>
          <input
            className="input text-center tracking-[0.3em]"
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? "text" : "password"}
              placeholder="Nova senha (mín. 6 caracteres)"
              autoComplete="new-password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <input
            className="input"
            type={showPassword ? "text" : "password"}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            minLength={6}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 py-2 text-sm" disabled={saving}>
              {saving ? <Loader size={16} color="#fff" /> : "Salvar nova senha"}
            </button>
            <button type="button" className="btn-secondary py-2 text-sm" onClick={reset}>
              Cancelar
            </button>
          </div>
          <button type="button" className="text-xs text-brand hover:underline" onClick={sendCode} disabled={saving}>
            Reenviar código
          </button>
        </form>
      )}
    </div>
  );
}
