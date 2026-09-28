"use client";

import { useEffect, useState } from "react";
import { Mail, MapPin, Phone, Search, ShoppingBag, User, X } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { centsToBRL } from "@/lib/money";
import { formatCPF } from "@/lib/cpf";
import { Loader } from "@/components/ui/Loader";
import { Pagination } from "@/components/ui/Pagination";
import type { OrderStatus, UserAddress } from "@/lib/types";

type UserRow = { id: string; name: string; email: string; auth_provider: string; created_at: string };
type UserDetails = {
  user: UserRow & { phone: string | null; cpf: string | null };
  addresses: UserAddress[];
  orders: { id: string; status: OrderStatus; total_cents: number; created_at: string }[];
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  confirmed: "Confirmado",
  preparing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const PAID_LIKE: OrderStatus[] = ["paid", "confirmed", "preparing", "shipped", "delivered"];
const PAGE_SIZE = 15;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function UsersManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    adminApi<{ users: UserRow[] }>("listUsers")
      .then(({ users }) => setUsers(users))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => setPage(1), [search]);

  useEffect(() => {
    if (!details && !loadingDetails) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDetails();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [details, loadingDetails]);

  async function openDetails(id: string) {
    setLoadingDetails(true);
    try {
      setDetails(await adminApi<UserDetails>("getUserDetails", { id }));
    } finally {
      setLoadingDetails(false);
    }
  }

  function closeDetails() {
    setDetails(null);
    setLoadingDetails(false);
  }

  const q = search.trim().toLowerCase();
  const filtered = users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const paidOrders = details?.orders.filter((o) => PAID_LIKE.includes(o.status)) ?? [];
  const totalSpent = paidOrders.reduce((sum, o) => sum + o.total_cents, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-slate-900">Usuários</h1>
        <p className="text-sm text-slate-500">
          {users.length} {users.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}
        </p>
      </div>

      <div className="relative mb-4 sm:w-80">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          className="input pl-10"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : pageItems.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">Nenhum usuário encontrado.</p>
      ) : (
        <div className="card divide-y divide-blue-50">
          {pageItems.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-brand">
                  {u.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-slate-900">{u.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {u.email} · desde {formatDate(u.created_at)}
                  </p>
                </div>
              </div>
              <button className="btn-secondary shrink-0 px-3 py-2" onClick={() => openDetails(u.id)}>
                Ver detalhes
              </button>
            </div>
          ))}
        </div>
      )}

      <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />

      {(details || loadingDetails) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
          onClick={closeDetails}
        >
          <div
            className="card max-h-full w-full max-w-lg overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {loadingDetails || !details ? (
              <div className="flex justify-center py-10">
                <Loader />
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-lg text-white">
                      {details.user.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <h2 className="font-display text-xl text-slate-900">{details.user.name}</h2>
                      <p className="text-xs text-slate-500">
                        Cliente desde {formatDate(details.user.created_at)} ·{" "}
                        {details.user.auth_provider === "google" ? "entrou com Google" : "cadastro por e-mail"}
                      </p>
                    </div>
                  </div>
                  <button
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    onClick={closeDetails}
                    aria-label="Fechar"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-2 text-sm text-slate-700">
                  <p className="flex items-center gap-2">
                    <Mail size={15} className="text-brand" /> {details.user.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone size={15} className="text-brand" /> {details.user.phone || "Sem telefone cadastrado"}
                  </p>
                  <p className="flex items-center gap-2">
                    <User size={15} className="text-brand" />
                    CPF: {details.user.cpf ? formatCPF(details.user.cpf) : "não informado"}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-blue-50/60 p-3">
                    <p className="text-xs text-slate-500">Pedidos pagos</p>
                    <p className="text-lg text-slate-900">{paidOrders.length}</p>
                  </div>
                  <div className="rounded-xl bg-blue-50/60 p-3">
                    <p className="text-xs text-slate-500">Total gasto</p>
                    <p className="text-lg text-brand">{centsToBRL(totalSpent)}</p>
                  </div>
                </div>

                <h3 className="font-display mb-2 mt-5 flex items-center gap-2 text-slate-900">
                  <MapPin size={16} className="text-brand" /> Endereços
                </h3>
                {details.addresses.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum endereço cadastrado.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-600">
                    {details.addresses.map((a) => (
                      <li key={a.id} className="rounded-lg border border-blue-50 p-2">
                        <span className="text-slate-800">{a.label || "Endereço"}</span>
                        {a.is_default && <span className="ml-2 text-xs text-brand">(padrão)</span>}
                        <br />
                        {a.street}, {a.number}
                        {a.complement ? ` - ${a.complement}` : ""} · {a.neighborhood} · {a.city}/{a.state} · {a.zip}
                      </li>
                    ))}
                  </ul>
                )}

                <h3 className="font-display mb-2 mt-5 flex items-center gap-2 text-slate-900">
                  <ShoppingBag size={16} className="text-brand" /> Últimos pedidos
                </h3>
                {details.orders.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum pedido ainda.</p>
                ) : (
                  <ul className="divide-y divide-blue-50 text-sm">
                    {details.orders.slice(0, 8).map((o) => (
                      <li key={o.id} className="flex items-center justify-between py-2">
                        <span className="text-slate-700">
                          #{o.id.slice(0, 8).toUpperCase()} · {formatDate(o.created_at)}
                        </span>
                        <span className="text-right">
                          <span className="block text-slate-900">{centsToBRL(o.total_cents)}</span>
                          <span className="text-xs text-slate-500">{STATUS_LABELS[o.status]}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
