"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Minus,
  Package,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  UserCheck,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { centsToBRL } from "@/lib/money";
import { orderCode } from "@/lib/orderCode";
import { Loader } from "@/components/ui/Loader";
import { formatCPF, isValidCPF } from "@/lib/cpf";
import type { Order, ProductFlavor, ProductWithFullFlavors } from "@/lib/types";

type Line = {
  key: string;
  productId: string;
  flavorId: string | null;
  name: string;
  flavorName: string | null;
  image: string | null;
  quantity: number;
  maxStock: number;
  /** Preço cobrado, como texto ("42,90"), pra poder dar desconto. */
  price: string;
};

type PaymentMethod = "dinheiro" | "pix" | "debito" | "credito";

type Customer = { id: string; name: string; email: string; phone: string | null; cpf: string | null };

/** Campos que sugerem clientes cadastrados enquanto digita. */
type LookupField = "name" | "phone" | "cpf";

const PAYMENTS: { id: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { id: "dinheiro", label: "Dinheiro", icon: Banknote },
  { id: "pix", label: "Pix", icon: QrCode },
  { id: "debito", label: "Débito", icon: CreditCard },
  { id: "credito", label: "Crédito", icon: Wallet },
];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
};

function toCents(value: string) {
  const n = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function toReais(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Caixa do balcão: o operador clica nos produtos que o cliente levou, escolhe
 * a forma de pagamento e registra. O estoque é o mesmo da loja online.
 */
export function InStoreSaleDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = useState<ProductWithFullFlavors[] | null>(null);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [received, setReceived] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [linked, setLinked] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[] | null>(null);
  const [lookupField, setLookupField] = useState<LookupField | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Order | null>(null);
  const [mobileView, setMobileView] = useState<"produtos" | "venda">("produtos");

  async function loadProducts() {
    const { products } = await adminApi<{ products: ProductWithFullFlavors[] }>("listProducts");
    setProducts(products.filter((p) => p.active));
  }

  useEffect(() => {
    loadProducts().catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, saving]);

  // Busca de cliente já cadastrado no site (espera parar de digitar).
  useEffect(() => {
    const q = customerQuery.trim();
    if (q.length < 2) {
      setCustomerResults(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      adminApi<{ customers: Customer[] }>("searchCustomers", { q })
        .then(({ customers }) => {
          if (cancelled) return;
          setCustomerResults(customers);
          setHighlight(0);
        })
        .catch(() => !cancelled && setCustomerResults([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [customerQuery]);

  function pickCustomer(c: Customer) {
    setLinked(c);
    setCustomerName(c.name);
    setCustomerEmail(c.email);
    setCustomerPhone(c.phone ?? "");
    setCustomerCpf(c.cpf ? formatCPF(c.cpf) : "");
    setCustomerQuery("");
    setCustomerResults(null);
    setLookupField(null);
  }

  /** Digitando no nome, WhatsApp ou CPF: busca clientes cadastrados com aquilo. */
  function typeCustomerField(field: LookupField, value: string) {
    if (field === "name") setCustomerName(value);
    if (field === "phone") setCustomerPhone(value);
    if (field === "cpf") setCustomerCpf(value);
    if (linked) return;
    setLookupField(field);
    setCustomerQuery(value);
  }

  function lookupKeys(e: React.KeyboardEvent<HTMLInputElement>) {
    const list = customerResults ?? [];
    if (!lookupField || list.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % list.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + list.length) % list.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickCustomer(list[Math.min(highlight, list.length - 1)]);
    } else if (e.key === "Escape") {
      // Fecha só a lista, não o caixa.
      e.stopPropagation();
      setLookupField(null);
    }
  }

  function suggestions(field: LookupField) {
    if (linked || lookupField !== field || !customerResults || customerQuery.trim().length < 2) return null;
    return (
      <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-blue-100 bg-white shadow-xl">
        {customerResults.length === 0 ? (
          <p className="p-3 text-xs text-slate-500">Nenhum cliente cadastrado com isso — é só continuar preenchendo.</p>
        ) : (
          <>
            <p className="border-b border-blue-50 px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400">
              Clientes cadastrados no site
            </p>
            {customerResults.map((c, i) => (
              <button
                key={c.id}
                type="button"
                // mouseDown (e não click) pra escolher antes do campo perder o foco
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickCustomer(c);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center gap-2.5 border-b border-blue-50 px-3 py-2 text-left last:border-0 ${
                  i === highlight ? "bg-blue-50" : ""
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm text-brand">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800">{c.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {[c.phone, c.cpf ? formatCPF(c.cpf) : null, c.email].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    );
  }

  function unlinkCustomer() {
    setLinked(null);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCustomerCpf("");
  }

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return (products ?? []).filter((p) => !q || normalize(p.name).includes(q));
  }, [products, query]);

  const inCart = (key: string) => lines.find((l) => l.key === key)?.quantity ?? 0;

  function add(product: ProductWithFullFlavors, flavor?: ProductFlavor) {
    const key = `${product.id}:${flavor?.id ?? ""}`;
    const stock = flavor ? flavor.stock : product.stock;
    setError(null);
    setLines((list) => {
      const existing = list.find((l) => l.key === key);
      if (existing) {
        return list.map((l) => (l.key === key ? { ...l, quantity: Math.min(l.quantity + 1, l.maxStock) } : l));
      }
      return [
        ...list,
        {
          key,
          productId: product.id,
          flavorId: flavor?.id ?? null,
          name: product.name,
          flavorName: flavor?.name ?? null,
          image: flavor?.image_url || product.images?.[0] || null,
          quantity: 1,
          maxStock: stock,
          price: toReais(product.price_cents),
        },
      ];
    });
    setPicking(null);
  }

  function setQty(key: string, quantity: number) {
    setLines((list) =>
      list
        .map((l) => (l.key === key ? { ...l, quantity: Math.min(Math.max(quantity, 0), l.maxStock) } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  const totalCents = lines.reduce((sum, l) => {
    const price = toCents(l.price);
    return sum + (Number.isFinite(price) ? price * l.quantity : 0);
  }, 0);
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const receivedCents = toCents(received);
  const change = payment === "dinheiro" && Number.isFinite(receivedCents) ? receivedCents - totalCents : null;

  async function submit() {
    setError(null);
    if (lines.length === 0) return setError("Adicione pelo menos um produto.");
    if (lines.some((l) => !Number.isFinite(toCents(l.price)) || toCents(l.price) < 0)) {
      return setError("Confira o preço dos itens.");
    }
    if (!payment) return setError("Escolha a forma de pagamento.");
    if (customerCpf.trim() && !isValidCPF(customerCpf)) return setError("Confira o CPF do cliente.");
    if (change != null && received.trim() && change < 0) {
      return setError("O valor recebido em dinheiro é menor que o total.");
    }
    setSaving(true);
    try {
      const { order } = await adminApi<{ order: Order }>("createInStoreSale", {
        items: lines.map((l) => ({
          productId: l.productId,
          flavorId: l.flavorId,
          quantity: l.quantity,
          unitPriceCents: toCents(l.price),
        })),
        paymentMethod: payment,
        customerName,
        customerPhone,
        customerCpf,
        customerEmail,
        userId: linked?.id ?? null,
        note,
      });
      setSaved(order);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a venda.");
    } finally {
      setSaving(false);
    }
  }

  function newSale() {
    setSaved(null);
    setLines([]);
    setPayment(null);
    setReceived("");
    unlinkCustomer();
    setCustomerQuery("");
    setNote("");
    setMobileView("produtos");
    setProducts(null);
    loadProducts().catch(() => setProducts([]));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-brand-ink/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Venda no balcão"
        className="flex h-full w-full max-w-6xl animate-[popIn_.2s_ease-out] flex-col overflow-hidden bg-slate-50 shadow-2xl sm:h-[92vh] sm:rounded-3xl">
        {/* Topo */}
        <div
          className="theme-static flex items-center gap-3 px-5 py-4 text-white"
          style={{ background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 45%, #0284c7 100%)" }}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <Store size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight">Venda no balcão</p>
            <p className="text-xs text-blue-50">Clique nos produtos que o cliente levou — o estoque do site baixa junto.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl p-2 hover:bg-white/20"
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </div>

        {saved ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <span className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 size={44} />
            </span>
            <p className="font-display text-2xl text-slate-900">Venda registrada!</p>
            <p className="mt-1 text-slate-600">
              Venda #{orderCode(saved)}
              {saved.customer_name && saved.customer_name !== "Cliente no balcão" ? ` · ${saved.customer_name}` : ""} ·{" "}
              {centsToBRL(saved.total_cents)} ·{" "}
              {PAYMENT_METHOD_LABELS[saved.payment_status ?? ""] ?? saved.payment_status}
            </p>
            {change != null && change > 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-amber-800">
                Troco: <strong>{centsToBRL(change)}</strong>
              </p>
            )}
            <p className="mt-3 text-sm text-slate-500">O estoque já foi atualizado e a venda entra no Monitoramento.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" className="btn-primary" onClick={newSale}>
                <Plus size={18} /> Nova venda
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_400px]">
            {/* Produtos */}
            <div className={`min-h-0 flex-col ${mobileView === "produtos" ? "flex" : "hidden"} lg:flex`}>
              <div className="border-b border-blue-100 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    className="input pl-10"
                    placeholder="Buscar produto..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {!products ? (
                  <div className="flex justify-center py-16">
                    <Loader />
                  </div>
                ) : visible.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">Nenhum produto encontrado.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {visible.map((p) => {
                      const flavors = (p.product_flavors ?? []).slice().sort((a, b) => a.position - b.position);
                      const hasFlavors = flavors.length > 0;
                      const stock = hasFlavors ? flavors.reduce((n, f) => n + f.stock, 0) : p.stock;
                      const available = hasFlavors ? stock : p.stock - inCart(`${p.id}:`);
                      const out = available <= 0;
                      return (
                        <div key={p.id} className="card relative flex flex-col overflow-hidden">
                          <button
                            type="button"
                            disabled={out && !hasFlavors}
                            onClick={() => (hasFlavors ? setPicking(picking === p.id ? null : p.id) : add(p))}
                            className="group flex flex-1 flex-col text-left disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <div className="relative aspect-square w-full bg-slate-100">
                              {p.images?.[0] ? (
                                <Image src={p.images[0]} alt="" fill className="object-cover" sizes="200px" />
                              ) : (
                                <Package className="absolute inset-0 m-auto text-slate-300" size={32} />
                              )}
                              <span
                                className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] ${
                                  stock > 0 ? "bg-white/90 text-slate-700" : "bg-red-500 text-white"
                                }`}
                              >
                                {stock > 0 ? `${stock} em estoque` : "Esgotado"}
                              </span>
                            </div>
                            <div className="flex flex-1 flex-col p-2.5">
                              <p className="line-clamp-2 text-sm text-slate-800">{p.name}</p>
                              <p className="mt-auto pt-1 text-sm text-brand">{centsToBRL(p.price_cents)}</p>
                              {hasFlavors && <p className="text-[11px] text-slate-500">{flavors.length} sabores</p>}
                            </div>
                          </button>
                          {picking === p.id && (
                            <div className="border-t border-blue-100 bg-blue-50/60 p-2">
                              <p className="mb-1.5 text-xs text-slate-600">Qual sabor?</p>
                              <div className="flex flex-wrap gap-1.5">
                                {flavors.map((f) => {
                                  const left = f.stock - inCart(`${p.id}:${f.id}`);
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      disabled={left <= 0}
                                      onClick={() => add(p, f)}
                                      className="rounded-full border border-blue-100 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:line-through disabled:opacity-50"
                                    >
                                      {f.name} <span className="text-slate-400">({Math.max(left, 0)})</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Venda */}
            <div
              className={`min-h-0 flex-col border-blue-100 bg-white lg:flex lg:border-l ${
                mobileView === "venda" ? "flex" : "hidden"
              }`}
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <p className="font-display mb-3 flex items-center gap-2 text-slate-900">
                  <ShoppingBag size={18} className="text-brand" /> Itens da venda
                </p>
                {lines.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    Clique nos produtos pra adicionar.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {lines.map((l) => (
                      <li key={l.key} className="flex gap-3 rounded-xl border border-blue-100 p-2.5">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {l.image && <Image src={l.image} alt="" fill className="object-cover" sizes="48px" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-1 text-sm text-slate-800">
                              {l.name}
                              {l.flavorName && <span className="text-slate-500"> · {l.flavorName}</span>}
                            </p>
                            <button
                              type="button"
                              onClick={() => setQty(l.key, 0)}
                              className="text-slate-400 hover:text-red-600"
                              aria-label="Tirar da venda"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex items-center rounded-lg border border-blue-100">
                              <button
                                type="button"
                                className="p-1.5 text-brand hover:bg-blue-50"
                                onClick={() => setQty(l.key, l.quantity - 1)}
                                aria-label="Menos"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-7 text-center text-sm">{l.quantity}</span>
                              <button
                                type="button"
                                className="p-1.5 text-brand hover:bg-blue-50 disabled:text-slate-300"
                                onClick={() => setQty(l.key, l.quantity + 1)}
                                disabled={l.quantity >= l.maxStock}
                                aria-label="Mais"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <span className="text-xs text-slate-400">×</span>
                            <div className="relative w-24">
                              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                R$
                              </span>
                              <input
                                className="input py-1.5 pl-7 pr-2 text-sm"
                                inputMode="decimal"
                                value={l.price}
                                onChange={(e) =>
                                  setLines((list) =>
                                    list.map((x) => (x.key === l.key ? { ...x, price: e.target.value } : x))
                                  )
                                }
                                aria-label="Preço cobrado"
                                title="Preço cobrado (dá pra mudar se der desconto)"
                              />
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="font-display mb-2 mt-5 text-sm text-slate-900">Forma de pagamento</p>
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENTS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPayment(m.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2.5 text-xs transition ${
                        payment === m.id
                          ? "border-brand bg-blue-50 text-brand"
                          : "border-blue-100 text-slate-600 hover:border-brand"
                      }`}
                    >
                      <m.icon size={20} />
                      {m.label}
                    </button>
                  ))}
                </div>
                {payment === "dinheiro" && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-blue-50/60 p-3">
                    <label className="flex-1 text-xs text-slate-600">
                      Valor recebido
                      <input
                        className="input mt-1 py-2"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={received}
                        onChange={(e) => setReceived(e.target.value)}
                      />
                    </label>
                    <div className="text-right">
                      <p className="text-xs text-slate-600">Troco</p>
                      <p className={`font-display text-lg ${change != null && change < 0 ? "text-red-600" : "text-slate-900"}`}>
                        {change != null && received.trim() ? centsToBRL(Math.max(change, 0)) : "—"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-5">
                  <p className="font-display mb-2 flex items-center gap-2 text-sm text-slate-900">
                    <UserRound size={16} className="text-brand" /> Quem comprou{" "}
                    <span className="text-xs text-slate-400">(opcional)</span>
                  </p>

                  {linked ? (
                    <div className="mb-2 flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 p-2.5 text-sm text-green-700">
                      <UserCheck size={16} className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        Cliente do site: <strong>{linked.name}</strong>
                        <span className="block text-xs">A venda também aparece em &quot;Meus pedidos&quot; dele.</span>
                      </span>
                      <button
                        type="button"
                        onClick={unlinkCustomer}
                        className="rounded-lg p-1 hover:bg-green-100"
                        aria-label="Desvincular cliente"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <p className="mb-2 text-xs text-slate-500">
                      Comece a digitar o nome, WhatsApp ou CPF: se a pessoa tiver cadastro no site, ela aparece pra
                      selecionar.
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="relative col-span-2">
                      <input
                        className="input py-2"
                        placeholder="Nome"
                        autoComplete="off"
                        value={customerName}
                        onChange={(e) => typeCustomerField("name", e.target.value)}
                        onKeyDown={lookupKeys}
                        onBlur={() => setLookupField(null)}
                      />
                      {suggestions("name")}
                    </div>
                    <div className="relative">
                      <input
                        className="input py-2"
                        placeholder="WhatsApp (com DDD)"
                        inputMode="tel"
                        autoComplete="off"
                        value={customerPhone}
                        onChange={(e) => typeCustomerField("phone", e.target.value)}
                        onKeyDown={lookupKeys}
                        onBlur={() => setLookupField(null)}
                      />
                      {suggestions("phone")}
                    </div>
                    <div className="relative">
                      <input
                        className="input py-2"
                        placeholder="CPF"
                        inputMode="numeric"
                        autoComplete="off"
                        value={customerCpf}
                        onChange={(e) => typeCustomerField("cpf", formatCPF(e.target.value))}
                        onKeyDown={lookupKeys}
                        onBlur={() => setLookupField(null)}
                      />
                      {suggestions("cpf")}
                    </div>
                    <input
                      className="input col-span-2 py-2"
                      placeholder="E-mail"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                    <input
                      className="input col-span-2 py-2"
                      placeholder="Observação"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-blue-100 p-4">
                {error && <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-slate-600">
                    Total{itemCount > 0 ? ` · ${itemCount} ${itemCount === 1 ? "item" : "itens"}` : ""}
                  </span>
                  <span className="font-display text-3xl text-brand">{centsToBRL(totalCents)}</span>
                </div>
                <button
                  type="button"
                  className="btn-primary w-full py-3 text-base"
                  onClick={submit}
                  disabled={saving || lines.length === 0}
                >
                  {saving ? <Loader size={18} color="#fff" /> : "Registrar venda"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Celular: alterna entre produtos e a venda */}
        {!saved && (
          <div className="grid grid-cols-2 border-t border-blue-100 bg-white lg:hidden">
            <button
              type="button"
              onClick={() => setMobileView("produtos")}
              className={`py-3 text-sm ${mobileView === "produtos" ? "text-brand" : "text-slate-500"}`}
            >
              Produtos
            </button>
            <button
              type="button"
              onClick={() => setMobileView("venda")}
              className={`py-3 text-sm ${mobileView === "venda" ? "text-brand" : "text-slate-500"}`}
            >
              Venda ({itemCount}) · {centsToBRL(totalCents)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
