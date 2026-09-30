"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { User, Mail, Phone, CreditCard, MapPin, Plus, Pencil, Star, KeyRound } from "lucide-react";
import { Loader } from "@/components/ui/Loader";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { AddressForm, type AddressFormValues } from "@/components/account/AddressForm";
import { PasswordChange } from "@/components/account/PasswordChange";
import { formatCPF, isValidCPF } from "@/lib/cpf";
import type { UserAddress } from "@/lib/types";

export default function MinhaContaPage() {
  const { data: session, status } = useSession();
  const [form, setForm] = useState({ name: "", email: "", phone: "", cpf: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [emailStep, setEmailStep] = useState<"idle" | "enterEmail" | "enterCode">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailChangeSaving, setEmailChangeSaving] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [emailChangeDone, setEmailChangeDone] = useState(false);

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const { confirm, dialog } = useConfirm();

  async function loadAddresses() {
    setAddressesLoading(true);
    const res = await fetch("/api/enderecos");
    const data = await res.json();
    setAddresses(data.addresses ?? []);
    setAddressesLoading(false);
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/conta")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Não foi possível carregar seus dados.");
          return;
        }
        if (data.user) {
          setForm({
            name: data.user.name ?? "",
            email: data.user.email ?? "",
            phone: data.user.phone ?? "",
            cpf: data.user.cpf ? formatCPF(data.user.cpf) : "",
          });
        }
      })
      .catch(() => setError("Erro de conexão ao carregar seus dados."))
      .finally(() => setLoading(false));
    loadAddresses();
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    if (form.cpf && !isValidCPF(form.cpf)) {
      setError("CPF inválido. Confira os números digitados.");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/conta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, phone: form.phone, cpf: form.cpf || undefined }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar seus dados.");
      return;
    }

    setMessage("Dados atualizados com sucesso!");
  }

  async function handleRequestEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailChangeSaving(true);
    setEmailChangeError(null);

    const res = await fetch("/api/conta/email/solicitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail }),
    });
    const data = await res.json().catch(() => ({}));

    setEmailChangeSaving(false);

    if (!res.ok) {
      setEmailChangeError(data.error ?? "Não foi possível enviar o código.");
      return;
    }

    setEmailStep("enterCode");
  }

  async function handleConfirmEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailChangeSaving(true);
    setEmailChangeError(null);

    const res = await fetch("/api/conta/email/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: emailCode }),
    });
    const data = await res.json().catch(() => ({}));

    setEmailChangeSaving(false);

    if (!res.ok) {
      setEmailChangeError(data.error ?? "Não foi possível confirmar o código.");
      return;
    }

    setEmailChangeDone(true);
    setTimeout(() => signOut({ callbackUrl: "/login" }), 2500);
  }

  function cancelEmailChange() {
    setEmailStep("idle");
    setNewEmail("");
    setEmailCode("");
    setEmailChangeError(null);
  }

  function addressToFormValues(a: UserAddress): AddressFormValues {
    return {
      label: a.label ?? "",
      street: a.street,
      number: a.number,
      complement: a.complement ?? "",
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
      zip: a.zip,
      isDefault: a.is_default,
    };
  }

  async function handleCreateAddress(values: AddressFormValues) {
    const res = await fetch("/api/enderecos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, label: values.label || undefined, complement: values.complement || undefined }),
    });
    if (!res.ok) throw new Error("Não foi possível salvar o endereço.");
    setShowAddressForm(false);
    await loadAddresses();
  }

  async function handleUpdateAddress(id: string, values: AddressFormValues) {
    const res = await fetch(`/api/enderecos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, label: values.label || undefined, complement: values.complement || undefined }),
    });
    if (!res.ok) throw new Error("Não foi possível atualizar o endereço.");
    setEditingAddress(null);
    await loadAddresses();
  }

  async function handleSetDefault(a: UserAddress) {
    await fetch(`/api/enderecos/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addressToFormValues(a), isDefault: true }),
    });
    await loadAddresses();
  }

  async function handleDeleteAddress(a: UserAddress) {
    const ok = await confirm(
      `Tem certeza que deseja excluir o endereço "${a.label || a.street}"? Essa ação não pode ser desfeita.`
    );
    if (!ok) return;
    await fetch(`/api/enderecos/${a.id}`, { method: "DELETE" });
    await loadAddresses();
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
    <div className="bg-soft-auth min-h-[calc(100vh-4rem)] px-4 py-12">
      <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
        <div className="card h-fit p-8">
          <h1 className="font-display mb-1 text-2xl text-slate-900">Meus dados</h1>
          <p className="mb-6 text-sm text-slate-500">Atualize suas informações de contato</p>

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
              <div className="relative">
                <CreditCard className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  className="input pl-10"
                  placeholder="CPF"
                  maxLength={14}
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })}
                />
              </div>

              {message && <p className="text-sm font-medium text-green-600">{message}</p>}
              {error && <p className="text-sm font-medium text-red-600">{error}</p>}

              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? <Loader size={18} color="#fff" /> : "Salvar"}
              </button>
            </form>
          )}

          {!loading && emailStep === "idle" && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                className="text-xs font-bold text-brand hover:underline"
                onClick={() => setEmailStep("enterEmail")}
              >
                Trocar e-mail
              </button>
              <PasswordChange email={form.email} />
            </div>
          )}

          {emailStep === "enterEmail" && (
            <div className="mt-3 rounded-xl bg-blue-50/60 p-3">
              <form onSubmit={handleRequestEmailChange} className="space-y-2">
                <label className="block text-xs font-bold text-slate-600">Novo e-mail</label>
                <input
                  className="input"
                  type="email"
                  placeholder="novo@email.com"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                {emailChangeError && <p className="text-sm font-medium text-red-600">{emailChangeError}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary flex-1 py-2 text-sm" disabled={emailChangeSaving}>
                    {emailChangeSaving ? <Loader size={16} color="#fff" /> : "Enviar código"}
                  </button>
                  <button type="button" className="btn-secondary py-2 text-sm" onClick={cancelEmailChange}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {emailStep === "enterCode" && (
            <div className="mt-3 rounded-xl bg-blue-50/60 p-3">
              {emailChangeDone ? (
                <p className="text-sm font-medium text-green-600">
                  E-mail alterado! Você será desconectado pra entrar de novo com o novo e-mail...
                </p>
              ) : (
                <form onSubmit={handleConfirmEmailChange} className="space-y-2">
                  <label className="flex items-center gap-1 text-xs font-bold text-slate-600">
                    <KeyRound size={12} /> Código enviado para {newEmail}
                  </label>
                  <input
                    className="input text-center tracking-[0.3em]"
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={10}
                    required
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                  />
                  {emailChangeError && <p className="text-sm font-medium text-red-600">{emailChangeError}</p>}
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary flex-1 py-2 text-sm" disabled={emailChangeSaving}>
                      {emailChangeSaving ? <Loader size={16} color="#fff" /> : "Confirmar código"}
                    </button>
                    <button type="button" className="btn-secondary py-2 text-sm" onClick={cancelEmailChange}>
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/pedidos" className="font-bold text-brand hover:underline">
              Ver meus pedidos
            </Link>
          </p>
        </div>

        <div className="card h-fit p-8">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display flex items-center gap-2 text-xl text-slate-900">
              <MapPin size={20} className="text-brand" /> Meus endereços
            </h2>
            {!showAddressForm && !editingAddress && (
              <button
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => setShowAddressForm(true)}
              >
                <Plus size={14} /> Novo
              </button>
            )}
          </div>
          <p className="mb-4 text-sm text-slate-500">Usados pra preencher o endereço no checkout</p>

          {showAddressForm && (
            <div className="mb-4 rounded-xl bg-blue-50/60 p-4">
              <AddressForm
                onSubmit={handleCreateAddress}
                onCancel={() => setShowAddressForm(false)}
                submitLabel="Adicionar endereço"
              />
            </div>
          )}

          {editingAddress && (
            <div className="mb-4 rounded-xl bg-blue-50/60 p-4">
              <AddressForm
                initial={addressToFormValues(editingAddress)}
                onSubmit={(values) => handleUpdateAddress(editingAddress.id, values)}
                onCancel={() => setEditingAddress(null)}
                submitLabel="Salvar alterações"
              />
            </div>
          )}

          {addressesLoading ? (
            <div className="flex justify-center py-8">
              <Loader />
            </div>
          ) : addresses.length === 0 && !showAddressForm ? (
            <p className="text-sm text-slate-500">Você ainda não tem nenhum endereço cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {addresses.map((a) => (
                <div key={a.id} className="rounded-xl border border-blue-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 font-bold text-slate-800">
                        {a.label || "Endereço"}
                        {a.is_default && (
                          <span className="flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-brand">
                            <Star size={10} fill="currentColor" /> Padrão
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-slate-500">
                        {a.street}, {a.number}
                        {a.complement ? ` - ${a.complement}` : ""} - {a.neighborhood} - {a.city}/{a.state} -{" "}
                        {a.zip}
                      </p>
                    </div>
                    <button
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-brand"
                      onClick={() => setEditingAddress(a)}
                      aria-label="Editar endereço"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-3 text-xs font-bold">
                    {!a.is_default && (
                      <button className="text-brand hover:underline" onClick={() => handleSetDefault(a)}>
                        Tornar padrão
                      </button>
                    )}
                    <button className="text-red-600 hover:underline" onClick={() => handleDeleteAddress(a)}>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {dialog}
    </div>
  );
}
