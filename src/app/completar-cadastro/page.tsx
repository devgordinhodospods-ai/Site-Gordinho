"use client";

import { safePath } from "@/lib/safePath";
import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Phone } from "lucide-react";
import { AddressForm, type AddressFormValues } from "@/components/account/AddressForm";
import { LoaderPage } from "@/components/ui/Loader";
import { formatCPF, isValidCPF } from "@/lib/cpf";

function CompletarCadastroContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safePath(searchParams.get("next"));

  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/completar-cadastro?next=${next}`)}`);
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/conta")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.cpf) {
          router.replace(next);
          return;
        }
        setName(data.user?.name ?? "");
        setPhone(data.user?.phone ?? "");
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [status, router, next]);

  async function handleSubmit(address: AddressFormValues) {
    if (!isValidCPF(cpf)) {
      throw new Error("CPF inválido. Confira os números digitados.");
    }
    if (phone.replace(/\D/g, "").length < 10) {
      throw new Error("Informe um telefone/WhatsApp com DDD pra entrega.");
    }

    const contaRes = await fetch("/api/conta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, cpf, phone }),
    });
    if (!contaRes.ok) {
      const data = await contaRes.json().catch(() => ({}));
      throw new Error(data.error ?? "Não foi possível salvar seu CPF.");
    }

    const addressRes = await fetch("/api/enderecos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: address.label || undefined,
        street: address.street,
        number: address.number,
        complement: address.complement || undefined,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        zip: address.zip,
        isDefault: true,
      }),
    });
    if (!addressRes.ok) {
      throw new Error("Não foi possível salvar seu endereço.");
    }

    router.push(next);
  }

  if (status === "loading" || checking) {
    return <LoaderPage label="Preparando seu cadastro..." />;
  }

  return (
    <div className="bg-soft-auth flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="font-display mb-1 text-center text-2xl text-slate-900">Só mais um passo</h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          Precisamos do seu CPF, WhatsApp e endereço pra processar seus pedidos e a entrega
        </p>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-bold text-slate-500">CPF</label>
          <div className="relative">
            <CreditCard
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              className="input pl-10"
              placeholder="000.000.000-00"
              value={cpf}
              maxLength={14}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-bold text-slate-500">Telefone / WhatsApp</label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="input pl-10"
              placeholder="(11) 99999-9999"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          Endereço de entrega
        </p>
        <AddressForm onSubmit={handleSubmit} submitLabel="Concluir cadastro" showDefaultOption={false} />
      </div>
    </div>
  );
}

export default function CompletarCadastroPage() {
  return (
    <Suspense fallback={<LoaderPage />}>
      <CompletarCadastroContent />
    </Suspense>
  );
}
