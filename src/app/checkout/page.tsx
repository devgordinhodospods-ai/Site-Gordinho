"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, MapPin, Phone, ShoppingBag, Truck } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { centsToBRL } from "@/lib/money";
import { Loader, LoaderPage } from "@/components/ui/Loader";
import { AddressFields, EMPTY_ADDRESS_VALUES, type AddressValues } from "@/components/account/AddressFields";
import type { UserAddress } from "@/lib/types";
import type { FreightEstimate } from "@/lib/geo";

const NEW_ADDRESS = "new";

function StepTitle({ n, icon: Icon, children }: { n: number; icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <h2 className="font-display mb-4 flex items-center gap-2 text-lg text-slate-900">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-white">{n}</span>
      <Icon size={18} className="text-brand" />
      {children}
    </h2>
  );
}

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hydrated = useCartStore((s) => s.hydrated);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotalCents());
  const clearCart = useCartStore((s) => s.clear);

  const [serviceFee, setServiceFee] = useState({ percent: 0, fixed: 0 });
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAccount, setLoadingAccount] = useState(true);

  const [selectedAddressId, setSelectedAddressId] = useState<string>(NEW_ADDRESS);
  const [newAddress, setNewAddress] = useState<AddressValues>(EMPTY_ADDRESS_VALUES);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [phone, setPhone] = useState("");

  const [freight, setFreight] = useState<FreightEstimate | null>(null);
  const [loadingFreight, setLoadingFreight] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((data) => setServiceFee({ percent: data.serviceFeePercent ?? 0, fixed: data.serviceFeeFixed ?? 0 }))
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/enderecos").then((r) => r.json()).catch(() => ({})),
      fetch("/api/conta").then((r) => r.json()).catch(() => ({})),
    ]).then(([addrData, contaData]) => {
      if (contaData.user && !contaData.user.cpf) {
        router.replace("/completar-cadastro?next=/checkout");
        return;
      }
      const list: UserAddress[] = addrData.addresses ?? [];
      setAddresses(list);
      if (list.length > 0) setSelectedAddressId((list.find((a) => a.is_default) ?? list[0]).id);
      if (contaData.user?.phone) setPhone(contaData.user.phone);
      setLoadingAccount(false);
    });
  }, [status, router]);

  const address: AddressValues = useMemo(() => {
    const saved = addresses.find((a) => a.id === selectedAddressId);
    if (!saved) return newAddress;
    return {
      street: saved.street,
      number: saved.number,
      complement: saved.complement ?? "",
      neighborhood: saved.neighborhood,
      city: saved.city,
      state: saved.state,
      zip: saved.zip,
    };
  }, [addresses, selectedAddressId, newAddress]);

  // Estimativa de frete pelo CEP do endereço escolhido (pago ao entregador).
  const zipDigits = address.zip.replace(/\D/g, "");
  useEffect(() => {
    if (zipDigits.length !== 8) {
      setFreight(null);
      return;
    }
    setLoadingFreight(true);
    fetch(`/api/frete/estimativa?cep=${zipDigits}`)
      .then((res) => res.json())
      .then((data) => setFreight(data.estimate ?? null))
      .catch(() => setFreight(null))
      .finally(() => setLoadingFreight(false));
  }, [zipDigits]);

  const serviceFeeCents = Math.round((subtotal * serviceFee.percent) / 100) + serviceFee.fixed;
  // O frete é pago direto ao entregador — não entra no total do site.
  const total = subtotal + serviceFeeCents;

  if (status === "loading" || (status === "authenticated" && !hydrated)) {
    return <LoaderPage label="Carregando checkout..." />;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-brand">
          <Lock size={26} />
        </div>
        <h1 className="font-display text-xl text-slate-900">Entre pra finalizar a compra</h1>
        <p className="mt-1 text-sm text-slate-500">Seu carrinho fica guardado — é só fazer login.</p>
        <Link href="/login?callbackUrl=/checkout" className="btn-primary mt-6">
          Entrar ou criar conta
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-brand">
          <ShoppingBag size={28} />
        </div>
        <h1 className="font-display text-xl text-slate-900">Seu carrinho está vazio</h1>
        <Link href="/#produtos" className="btn-primary mt-6">
          Ver produtos
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (phone.replace(/\D/g, "").length < 10) {
      setError("Informe um telefone/WhatsApp com DDD — o entregador usa ele pra falar com você.");
      return;
    }

    if (freight?.status === "out_of_range") {
      setError("Ainda não entregamos nesse endereço. Escolha outro endereço de entrega.");
      return;
    }

    setSubmitting(true);
    try {
      if (selectedAddressId === NEW_ADDRESS && saveNewAddress) {
        await fetch("/api/enderecos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...address, complement: address.complement || undefined }),
        }).catch(() => null);
      }

      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            flavorId: i.flavorId ?? undefined,
          })),
          address: { ...address, complement: address.complement || undefined },
          customerPhone: phone,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Não foi possível finalizar o pedido.");
        setSubmitting(false);
        return;
      }

      clearCart();
      window.location.href = data.initPoint;
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display mb-6 text-2xl text-slate-900">Finalizar compra</h1>

      <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <StepTitle n={1} icon={MapPin}>
              Endereço de entrega
            </StepTitle>

            {loadingAccount ? (
              <div className="flex justify-center py-6">
                <Loader />
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 transition ${
                      selectedAddressId === a.id ? "border-brand bg-blue-50/50" : "border-blue-100 hover:border-blue-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      className="mt-1 accent-[#1d4ed8]"
                      checked={selectedAddressId === a.id}
                      onChange={() => setSelectedAddressId(a.id)}
                    />
                    <span className="text-sm">
                      <span className="block text-slate-900">{a.label || "Endereço"}</span>
                      <span className="text-slate-500">
                        {a.street}, {a.number}
                        {a.complement ? ` - ${a.complement}` : ""} · {a.neighborhood} · {a.city}/{a.state} · {a.zip}
                      </span>
                    </span>
                  </label>
                ))}

                {addresses.length > 0 && (
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-sm transition ${
                      selectedAddressId === NEW_ADDRESS ? "border-brand bg-blue-50/50" : "border-blue-100 hover:border-blue-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      className="accent-[#1d4ed8]"
                      checked={selectedAddressId === NEW_ADDRESS}
                      onChange={() => setSelectedAddressId(NEW_ADDRESS)}
                    />
                    Entregar em outro endereço
                  </label>
                )}

                {selectedAddressId === NEW_ADDRESS && (
                  <div className={addresses.length > 0 ? "pt-2" : ""}>
                    <AddressFields value={newAddress} onChange={setNewAddress} />
                    <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={saveNewAddress}
                        onChange={(e) => setSaveNewAddress(e.target.checked)}
                      />
                      Salvar este endereço na minha conta
                    </label>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <StepTitle n={2} icon={Phone}>
              Contato
            </StepTitle>
            <input
              className="input sm:max-w-xs"
              placeholder="Telefone / WhatsApp com DDD"
              inputMode="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="mt-2 text-xs text-slate-500">O entregador usa esse número pra falar com você.</p>
          </section>

          <section className="card p-5 sm:p-6">
            <StepTitle n={3} icon={Truck}>
              Entrega
            </StepTitle>
            {freight?.status === "out_of_range" ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Ainda não entregamos em {freight.city}: fica a {freight.km} km da loja e atendemos até{" "}
                {freight.maxKm} km. Escolha outro endereço de entrega.
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
                <div className="mb-1 flex justify-between text-amber-900">
                  <span>Frete estimado (motoboy)</span>
                  <span>
                    {loadingFreight
                      ? "calculando..."
                      : freight?.status === "ok"
                        ? centsToBRL(freight.feeCents)
                        : zipDigits.length === 8
                          ? "a combinar"
                          : "—"}
                  </span>
                </div>
                O frete <strong>não é cobrado no site</strong>: ele é pago em dinheiro ou Pix{" "}
                <strong>direto ao entregador</strong> na hora da entrega.
              </div>
            )}
          </section>
        </div>

        <aside className="card p-5 lg:sticky lg:top-24">
          <h2 className="font-display mb-4 text-lg text-slate-900">Resumo do pedido</h2>

          <ul className="mb-4 max-h-72 space-y-3 overflow-y-auto pr-1">
            {items.map((item) => (
              <li key={`${item.productId}-${item.flavorId ?? ""}`} className="flex gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {item.image && <Image src={item.image} alt="" fill className="object-cover" sizes="48px" />}
                  <span className="absolute -right-0 -top-0 rounded-bl-md bg-brand px-1 text-[10px] text-white">
                    {item.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="line-clamp-1 text-slate-800">{item.name}</p>
                  {item.flavorName && <p className="text-xs text-slate-500">{item.flavorName}</p>}
                </div>
                <span className="text-sm text-slate-700">{centsToBRL(item.priceCents * item.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-1.5 border-t border-blue-50 pt-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{centsToBRL(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Taxa de serviço</span>
              <span>{centsToBRL(serviceFeeCents)}</span>
            </div>
            <div className="flex justify-between border-t border-blue-50 pt-2 text-base text-slate-900">
              <span>Total a pagar agora</span>
              <span className="text-brand">{centsToBRL(total)}</span>
            </div>
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <button type="submit" className="btn-primary mt-5 w-full py-3" disabled={submitting || loadingAccount || freight?.status === "out_of_range"}>
            {submitting ? <Loader size={18} color="#fff" /> : "Ir para o pagamento"}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400">
            <Lock size={12} /> Pagamento seguro via Mercado Pago (Pix ou cartão)
          </p>
        </aside>
      </form>
    </div>
  );
}
