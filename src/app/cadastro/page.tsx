"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Phone, Lock } from "lucide-react";
import { Loader } from "@/components/ui/Loader";

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Não foi possível criar a conta.");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    setLoading(false);
    // Depois de criar a conta, pede CPF, WhatsApp e endereço (igual ao Google).
    router.push("/completar-cadastro?next=/");
  }

  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(160deg, #eaf2ff 0%, #ffffff 55%)" }}
    >
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-display mb-1 text-center text-2xl text-slate-900">Criar conta</h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          Leva menos de um minuto
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="input pl-10"
              placeholder="Nome completo"
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
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="input pl-10"
              placeholder="Telefone / WhatsApp"
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
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <Loader size={18} color="#fff" /> : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Já tem conta?{" "}
          <Link href="/login" className="font-bold text-brand hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
