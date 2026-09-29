"use client";

import { safePath } from "@/lib/safePath";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, Lock, Mail, Phone, User } from "lucide-react";
import { Loader, LoaderPage } from "@/components/ui/Loader";

function CadastroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safePath(searchParams.get("callbackUrl"));

  const [step, setStep] = useState<"form" | "code">("form");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode() {
    const res = await fetch("/api/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar o código.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestCode();
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await requestCode();
      setInfo("Enviamos um novo código.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reenviar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const res = await fetch("/api/cadastro/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email, code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Não foi possível confirmar o código.");
      setLoading(false);
      return;
    }

    const login = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    if (login?.error) {
      router.push("/login");
      return;
    }
    router.push(`/completar-cadastro?next=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(160deg, #e0f7ff 0%, #ffffff 55%)" }}
    >
      <div className="card w-full max-w-sm p-8">
        {step === "form" ? (
          <>
            <h1 className="font-display mb-1 text-center text-2xl text-slate-900">Criar conta</h1>
            <p className="mb-6 text-center text-sm text-slate-500">Vamos confirmar seu e-mail com um código</p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  className="input pl-10"
                  placeholder="Nome completo"
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  className="input pl-10"
                  type="email"
                  placeholder="E-mail"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  className="input pl-10"
                  placeholder="WhatsApp com DDD"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  className="input pl-10"
                  type="password"
                  placeholder="Senha (mín. 6 caracteres)"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? <Loader size={18} color="#fff" /> : "Continuar"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Já tem conta?{" "}
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                className="text-brand hover:underline"
              >
                Entrar
              </Link>
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-brand">
              <KeyRound size={22} />
            </div>
            <h1 className="font-display mb-1 text-center text-2xl text-slate-900">Confirme seu e-mail</h1>
            <p className="mb-6 text-center text-sm text-slate-500">
              Mandamos um código para <span className="text-slate-800">{form.email}</span>. Confira também a caixa de
              spam.
            </p>

            <form onSubmit={handleConfirm} className="space-y-3">
              <input
                className="input text-center text-lg tracking-[0.4em]"
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              {info && <p className="text-sm text-green-700">{info}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading || code.length < 6}>
                {loading ? <Loader size={18} color="#fff" /> : "Confirmar e criar conta"}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between text-sm">
              <button
                type="button"
                className="flex items-center gap-1 text-slate-500 hover:text-brand"
                onClick={() => {
                  setStep("form");
                  setCode("");
                  setError(null);
                  setInfo(null);
                }}
              >
                <ArrowLeft size={14} /> Corrigir dados
              </button>
              <button type="button" className="text-brand hover:underline" onClick={handleResend} disabled={loading}>
                Reenviar código
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <Suspense fallback={<LoaderPage />}>
      <CadastroContent />
    </Suspense>
  );
}
