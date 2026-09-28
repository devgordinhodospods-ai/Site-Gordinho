"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { User, Mail, Phone } from "lucide-react";
import { Loader } from "@/components/ui/Loader";

export default function MinhaContaPage() {
  const { data: session, status } = useSession();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/conta")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setForm({ name: data.user.name ?? "", email: data.user.email ?? "", phone: data.user.phone ?? "" });
        }
      })
      .finally(() => setLoading(false));
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/conta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, phone: form.phone }),
    });

    setSaving(false);

    if (!res.ok) {
      setError("Não foi possível salvar seus dados.");
      return;
    }

    setMessage("Dados atualizados com sucesso!");
  }

  if (status === "loading") return null;

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-xl text-slate-900">Faça login para ver seus dados</h1>
        <Link href="/login?callbackUrl=/minha-conta" className="btn-primary mt-4 inline-flex">
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(160deg, #eaf2ff 0%, #ffffff 55%)" }}
    >
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-display mb-1 text-center text-2xl text-slate-900">Meus dados</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Atualize suas informações de contato</p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader />
          </div>
        ) : (
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
              <input className="input bg-slate-50 pl-10 text-slate-400" value={form.email} disabled />
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

            {message && <p className="text-sm font-medium text-green-600">{message}</p>}
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? <Loader size={18} color="#fff" /> : "Salvar"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/pedidos" className="font-bold text-brand hover:underline">
            Ver meus pedidos
          </Link>
        </p>
      </div>
    </div>
  );
}
