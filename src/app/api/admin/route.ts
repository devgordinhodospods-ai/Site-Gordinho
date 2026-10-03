import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { randomUUID } from "crypto";
import {
  sendOrderCancelledEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendPixPendingEmail,
} from "@/lib/email";
import { getSiteSettings } from "@/lib/settings";
import { getErrorMessage } from "@/lib/errors";
import { cancelAndRestock, releaseAbandonedOrders } from "@/lib/orders";
import { locateCep, suggestFreightPricing } from "@/lib/geo";
import { mercadoPagoDiagnostics } from "@/lib/mercadopago";
import { syncOrderPayment } from "@/lib/paymentSync";
import {
  getWhatsappStatus,
  newOrderAlertText,
  sendNewOrderAlert,
  sendWhatsappText,
  whatsappAlertConfigured,
  whatsappQrPageUrl,
} from "@/lib/whatsappAlert";
import type { OrderStatus } from "@/lib/types";

const READ_ACTIONS = new Set([
  "listProducts",
  "listCategories",
  "listOrders",
  "getOrder",
  "getSettings",
  "getDashboardStats",
  "listUsers",
  "getUserDetails",
]);

const PAID_LIKE_STATUSES = new Set(["paid", "confirmed", "preparing", "shipped", "delivered"]);

const PRODUCT_FIELDS = [
  "name",
  "slug",
  "description",
  "price_cents",
  "compare_at_price_cents",
  "cost_cents",
  "images",
  "category_id",
  "stock",
  "active",
] as const;

const FLAVOR_FIELDS = ["name", "stock", "image_url", "position"] as const;

const CATEGORY_FIELDS = ["name", "slug", "image_url", "position", "active"] as const;

const SETTINGS_KEYS = [
  "store_name",
  "store_logo_url",
  "store_favicon_url",
  "footer_image_url",
  "contact_whatsapp",
  "contact_email",
  "contact_instagram",
  "origin_cep",
  "origin_address",
  "origin_lat",
  "origin_lng",
  "shipping_base_fee_cents",
  "shipping_per_km_cents",
  "shipping_max_km",
  "service_fee_percent",
  "service_fee_fixed",
  "announcement_text",
  "hero_image_url",
  "hero_images",
  "hero_images_mobile",
  "whatsapp_alert_number",
  "closed_popup_enabled",
  "closed_days",
  "open_time",
  "close_time",
  "closed_manual",
  "closed_popup_title",
  "closed_popup_message",
] as const;

const PAGE_ROWS = 1000;

/** Busca todas as linhas de uma consulta, de 1000 em 1000 (limite do Supabase). */
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_ROWS) return rows;
  }
}

const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3, sem horário de verão desde 2019

/** Início de hoje, da semana (domingo) e do mês no horário de Brasília, como instantes UTC. */
function brasiliaPeriodStarts(now: Date) {
  const local = new Date(now.getTime() - BRASILIA_OFFSET_MS); // "relógio" de Brasília lido em UTC
  const toInstant = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) + BRASILIA_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  return {
    startOfDay: toInstant(y, m, d),
    startOfWeek: toInstant(y, m, d - local.getUTCDay()),
    startOfMonth: toInstant(y, m, 1),
  };
}

function pick<T extends Record<string, unknown>>(obj: T, allowed: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in obj) out[key] = obj[key];
  }
  return out;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Acesso restrito ao administrador da loja." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const action: string | undefined = body?.action;
  if (!action) {
    return NextResponse.json({ error: "Ação não informada." }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  if (action === "listOrders" || action === "getDashboardStats" || action === "listProducts") {
    await releaseAbandonedOrders();
  }

  try {
    switch (action) {
      // ---------------- produtos ----------------
      case "listProducts": {
        const { data, error } = await db
          .from("products")
          .select("*, categories(id, name), product_flavors(id, name, stock, image_url, position)")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ products: data });
      }

      case "saveProduct": {
        const fields = pick(body.fields ?? {}, PRODUCT_FIELDS);
        let productId: string = body.id;

        if (productId) {
          const { error } = await db
            .from("products")
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq("id", productId);
          if (error) throw error;
        } else {
          const { data, error } = await db.from("products").insert(fields).select("id").single();
          if (error) throw error;
          productId = data.id;
        }

        // Sabores: a lista enviada pelo painel é a lista completa atual.
        // Atualiza os que já existem (mantendo o id), cria os novos e apaga
        // só os removidos. Recriar tudo mudaria os ids e quebraria carrinhos
        // abertos e a devolução de estoque de pedidos pendentes.
        if (Array.isArray(body.flavors)) {
          const { data: currentFlavors, error: curError } = await db
            .from("product_flavors")
            .select("id")
            .eq("product_id", productId);
          if (curError) throw curError;

          const incoming = body.flavors as Record<string, unknown>[];
          const keepIds = new Set(
            incoming.map((f) => f.id).filter((id): id is string => typeof id === "string")
          );
          const toDelete = (currentFlavors ?? []).map((f) => f.id).filter((id) => !keepIds.has(id));
          if (toDelete.length > 0) {
            const { error: delError } = await db.from("product_flavors").delete().in("id", toDelete);
            if (delError) throw delError;
          }

          for (const [index, f] of incoming.entries()) {
            const row = { ...pick(f, FLAVOR_FIELDS), position: index, product_id: productId };
            const { error: flavorError } =
              typeof f.id === "string" && keepIds.has(f.id)
                ? await db.from("product_flavors").update(row).eq("id", f.id).eq("product_id", productId)
                : await db.from("product_flavors").insert(row);
            if (flavorError) throw flavorError;
          }
        }

        const { data: product, error: fetchError } = await db
          .from("products")
          .select("*, categories(id, name), product_flavors(id, name, stock, image_url, position)")
          .eq("id", productId)
          .single();
        if (fetchError) throw fetchError;

        return NextResponse.json({ product });
      }

      case "deleteProduct": {
        const { error } = await db.from("products").delete().eq("id", body.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ---------------- categorias ----------------
      case "listCategories": {
        const { data, error } = await db.from("categories").select("*").order("position");
        if (error) throw error;
        return NextResponse.json({ categories: data });
      }

      case "saveCategory": {
        const fields = pick(body.fields ?? {}, CATEGORY_FIELDS);
        if (body.id) {
          const { data, error } = await db
            .from("categories")
            .update(fields)
            .eq("id", body.id)
            .select()
            .single();
          if (error) throw error;
          return NextResponse.json({ category: data });
        }
        const { data, error } = await db.from("categories").insert(fields).select().single();
        if (error) throw error;
        return NextResponse.json({ category: data });
      }

      case "deleteCategory": {
        const { error } = await db.from("categories").delete().eq("id", body.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ---------------- dashboard de monitoramento ----------------
      case "getDashboardStats": {
        // O Supabase devolve no máximo 1000 linhas por consulta: busca em páginas.
        const orders = await fetchAllRows<{
          id: string;
          status: string;
          total_cents: number;
          service_fee_cents: number;
          created_at: string;
        }>((from, to) =>
          db.from("orders").select("id, status, total_cents, service_fee_cents, created_at").order("id").range(from, to)
        );
        const items = await fetchAllRows<{
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price_cents: number;
          unit_cost_cents: number | null;
        }>((from, to) =>
          db
            .from("order_items")
            .select("order_id, product_id, product_name, quantity, unit_price_cents, unit_cost_cents")
            .order("id")
            .range(from, to)
        );

        const orderById = new Map(orders.map((o) => [o.id, o]));

        // Período escolhido no painel (dias no horário de Brasília, "de" e "até"
        // inclusos). Sem período = desde o começo.
        const dayStart = (ymd: string, plusDays = 0) => {
          const [y, m, d] = ymd.split("-").map(Number);
          return new Date(Date.UTC(y, m - 1, d + plusDays) + BRASILIA_OFFSET_MS);
        };
        const validDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
        const rangeFrom = validDay(body.from) ? dayStart(body.from) : null;
        const rangeTo = validDay(body.to) ? dayStart(body.to, 1) : null;
        const inRange = (iso: string) => {
          const t = new Date(iso);
          return (!rangeFrom || t >= rangeFrom) && (!rangeTo || t < rangeTo);
        };
        const brasiliaDay = (iso: string) => new Date(new Date(iso).getTime() - BRASILIA_OFFSET_MS).toISOString().slice(0, 10);

        // "Hoje", "semana" e "mês" no horário de Brasília (o servidor roda em UTC).
        const { startOfDay, startOfWeek, startOfMonth } = brasiliaPeriodStarts(new Date());
        const periodsOf = (createdAt: Date) =>
          (
            [
              ["today", startOfDay],
              ["week", startOfWeek],
              ["month", startOfMonth],
            ] as const
          )
            .filter(([, start]) => createdAt >= start)
            .map(([key]) => key);

        let totalVendidoCents = 0;
        let taxasServicoCents = 0;
        let lucroProdutosCents = 0;
        let pedidosPagos = 0;
        let pedidosPendentes = 0;
        let pedidosCancelados = 0;

        const periodStats = {
          today: { vendasCents: 0, lucroCents: 0 },
          week: { vendasCents: 0, lucroCents: 0 },
          month: { vendasCents: 0, lucroCents: 0 },
        };

        // Vendas por dia dentro do período.
        type DayAgg = { date: string; pedidos: number; vendasCents: number; lucroCents: number };
        const byDay = new Map<string, DayAgg>();
        const dayOf = (iso: string) => {
          const date = brasiliaDay(iso);
          const agg = byDay.get(date) ?? { date, pedidos: 0, vendasCents: 0, lucroCents: 0 };
          byDay.set(date, agg);
          return agg;
        };
        let totalPedidos = 0;

        for (const o of orders) {
          const paid = PAID_LIKE_STATUSES.has(o.status);
          // "Hoje / semana / mês" sempre olham tudo; o resto respeita o período.
          if (paid) {
            for (const key of periodsOf(new Date(o.created_at))) {
              periodStats[key].vendasCents += o.total_cents;
              periodStats[key].lucroCents += o.service_fee_cents;
            }
          }
          if (!inRange(o.created_at)) continue;
          totalPedidos += 1;
          if (paid) {
            totalVendidoCents += o.total_cents;
            taxasServicoCents += o.service_fee_cents;
            pedidosPagos += 1;
            // A taxa de serviço fica com a loja: entra no lucro.
            const day = dayOf(o.created_at);
            day.pedidos += 1;
            day.vendasCents += o.total_cents;
            day.lucroCents += o.service_fee_cents;
          } else if (o.status === "awaiting_payment") {
            pedidosPendentes += 1;
          } else if (o.status === "cancelled") {
            pedidosCancelados += 1;
          }
        }

        type ProductAgg = { name: string; quantity: number; receitaCents: number; lucroCents: number };
        const productAgg = new Map<string, ProductAgg>();
        let itensSemCusto = 0;

        for (const item of items) {
          const order = orderById.get(item.order_id);
          if (!order || !PAID_LIKE_STATUSES.has(order.status)) continue;

          // Sem custo cadastrado o lucro do item fica superestimado (custo 0);
          // o painel avisa quantos itens estão nessa situação.
          const cost = item.unit_cost_cents ?? 0;
          const itemLucro = (item.unit_price_cents - cost) * item.quantity;
          const itemReceita = item.unit_price_cents * item.quantity;

          for (const key of periodsOf(new Date(order.created_at))) {
            periodStats[key].lucroCents += itemLucro;
          }
          if (!inRange(order.created_at)) continue;
          if (item.unit_cost_cents == null) itensSemCusto += item.quantity;
          lucroProdutosCents += itemLucro;
          dayOf(order.created_at).lucroCents += itemLucro;

          const key = item.product_id ?? item.product_name;
          const existing = productAgg.get(key) ?? {
            name: item.product_name,
            quantity: 0,
            receitaCents: 0,
            lucroCents: 0,
          };
          existing.quantity += item.quantity;
          existing.receitaCents += itemReceita;
          existing.lucroCents += itemLucro;
          productAgg.set(key, existing);
        }

        // Dias sem venda também aparecem (até 1 ano), pra ver o período inteiro.
        if (rangeFrom && rangeTo && rangeTo.getTime() - rangeFrom.getTime() <= 367 * 86400000) {
          for (let t = rangeFrom.getTime(); t < rangeTo.getTime(); t += 86400000) {
            const date = brasiliaDay(new Date(t).toISOString());
            if (!byDay.has(date)) byDay.set(date, { date, pedidos: 0, vendasCents: 0, lucroCents: 0 });
          }
        }
        const salesByDay = Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date));

        const topProducts = Array.from(productAgg.values())
          .sort((a, b) => b.receitaCents - a.receitaCents)
          .map((p) => ({
            ...p,
            margemPercent: p.receitaCents > 0 ? (p.lucroCents / p.receitaCents) * 100 : 0,
          }));

        const lucroTotalCents = lucroProdutosCents + taxasServicoCents;

        return NextResponse.json({
          totalVendidoCents,
          lucroTotalCents,
          lucroProdutosCents,
          taxasServicoCents,
          // Margem sobre tudo que entrou (produtos + taxa de serviço).
          margemPercent: totalVendidoCents > 0 ? (lucroTotalCents / totalVendidoCents) * 100 : 0,
          itensSemCusto,
          totalPedidos,
          pedidosPagos,
          pedidosPendentes,
          pedidosCancelados,
          ticketMedioCents: pedidosPagos > 0 ? Math.round(totalVendidoCents / pedidosPagos) : 0,
          periodStats,
          topProducts,
          salesByDay,
        });
      }

      // ---------------- pedidos ----------------
      case "listOrders": {
        // Pix ainda aguardando: confere no Mercado Pago antes de listar (garante
        // que o pedido vire pago mesmo se o aviso do MP não chegar).
        const { data: waiting } = await db
          .from("orders")
          .select("id, status, payment_id, pix_qr_code")
          .eq("status", "awaiting_payment")
          .not("pix_qr_code", "is", null)
          .limit(10);
        await Promise.all((waiting ?? []).map((o) => syncOrderPayment(o)));

        let query = db
          .from("orders")
          .select("*, order_items(*)")
          .order("created_at", { ascending: false });
        if (body.status) query = query.eq("status", body.status);
        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ orders: data });
      }

      case "orderPulse": {
        // Consultado pelo painel a cada poucos segundos pra tocar o som de
        // pedido novo. Confere antes os Pix recentes ainda aguardando (caso o
        // aviso do Mercado Pago atrase) e devolve os pedidos pagos ainda não
        // tratados (status "paid").
        const recent = new Date(Date.now() - 40 * 60 * 1000).toISOString();
        const { data: waiting } = await db
          .from("orders")
          .select("id, status, payment_id, pix_qr_code")
          .eq("status", "awaiting_payment")
          .not("pix_qr_code", "is", null)
          .gte("created_at", recent)
          .limit(5);
        await Promise.all((waiting ?? []).map((o) => syncOrderPayment(o)));

        const { data, error } = await db
          .from("orders")
          .select("id, day_number, order_day, created_at, customer_name, total_cents")
          .eq("status", "paid")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return NextResponse.json({ paid: data ?? [] });
      }

      case "getOrder": {
        const { data, error } = await db
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", body.id)
          .single();
        if (error) throw error;
        return NextResponse.json({ order: data });
      }

      case "updateOrderStatus": {
        const status = body.status as OrderStatus;
        const allowed: OrderStatus[] = [
          "awaiting_payment",
          "paid",
          "confirmed",
          "preparing",
          "shipped",
          "delivered",
          "cancelled",
        ];
        if (!allowed.includes(status)) {
          return NextResponse.json({ error: "Status inválido." }, { status: 400 });
        }

        const { data: current } = await db.from("orders").select("status").eq("id", body.id).maybeSingle();
        if (current?.status === "cancelled" && status !== "cancelled") {
          // O estoque já foi devolvido no cancelamento — reabrir o pedido
          // entregaria produto sem descontar do estoque.
          return NextResponse.json(
            { error: "Pedido cancelado não pode ser reaberto. Peça pro cliente fazer um novo pedido." },
            { status: 400 }
          );
        }

        let changed = false;
        if (status === "cancelled") {
          // Em qualquer etapa: os itens voltam pro estoque.
          await cancelAndRestock(body.id);
          changed = current?.status !== "cancelled";
        } else if (current && current.status !== status) {
          // Só troca se ninguém mudou antes (dois cliques seguidos não duplicam os avisos).
          const { error, count } = await db
            .from("orders")
            .update({ status, updated_at: new Date().toISOString() }, { count: "exact" })
            .eq("id", body.id)
            .eq("status", current.status);
          if (error) throw error;
          changed = Boolean(count);
        }

        const { data: order } = await db.from("orders").select("*").eq("id", body.id).single();
        // Só avisa o cliente quando o status realmente mudou.
        if (order && current && changed) {
          const settings = await getSiteSettings();
          if (status === "cancelled") {
            await sendOrderCancelledEmail({
              order,
              settings,
              // Já pago: a loja vai entrar em contato pra devolver o valor.
              reason: PAID_LIKE_STATUSES.has(current.status) ? "store_paid" : "store_unpaid",
            }).catch(() => null);
          } else {
            await sendOrderStatusUpdateEmail({ order, settings }).catch(() => null);
          }
          // Confirmado na mão (ex.: pago em dinheiro): o pedido "vira venda" agora,
          // então a loja recebe o aviso completo no WhatsApp, igual ao Pix aprovado.
          if (current.status === "awaiting_payment" && PAID_LIKE_STATUSES.has(status)) {
            const { data: items } = await db.from("order_items").select("*").eq("order_id", order.id);
            await sendNewOrderAlert({ order, items: items ?? [], settings, manual: true }).catch(() => null);
          }
        }

        return NextResponse.json({ order });
      }

      case "deleteOrder": {
        const { data: current } = await db.from("orders").select("status").eq("id", body.id).maybeSingle();
        if (!current) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

        // Qualquer pedido que ainda não foi entregue devolve os itens pro estoque
        // antes de sumir (ex.: pago e depois reembolsado). Entregue: o produto
        // saiu de verdade, então excluir é só limpar a lista — pra devolver o
        // estoque de um entregue, marque "Cancelado" antes.
        if (!["cancelled", "delivered"].includes(current.status)) {
          await cancelAndRestock(body.id);
        }

        const { error } = await db.from("orders").delete().eq("id", body.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ---------------- usuários ----------------
      case "listUsers": {
        const { data, error } = await db
          .from("site_users")
          .select("id, name, email, auth_provider, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ users: data });
      }

      case "getUserDetails": {
        const { data: user, error } = await db
          .from("site_users")
          .select("id, name, email, phone, cpf, auth_provider, created_at")
          .eq("id", body.id)
          .maybeSingle();
        if (error) throw error;
        if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

        const orderFields = "id, status, total_cents, created_at, order_day, day_number";
        const [{ data: addresses }, { data: byUser }, { data: byEmail }] = await Promise.all([
          db.from("user_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }),
          db.from("orders").select(orderFields).eq("user_id", user.id),
          db.from("orders").select(orderFields).eq("customer_email", user.email),
        ]);
        const orders = [...new Map([...(byUser ?? []), ...(byEmail ?? [])].map((o) => [o.id, o])).values()].sort(
          (a, b) => b.created_at.localeCompare(a.created_at)
        );

        return NextResponse.json({ user, addresses: addresses ?? [], orders });
      }

      case "deleteUser": {
        const { data: user } = await db.from("site_users").select("id, email").eq("id", body.id).maybeSingle();
        if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
        if (isAdminEmail(user.email)) {
          return NextResponse.json({ error: "Não dá pra excluir a conta de um administrador." }, { status: 400 });
        }

        // Endereços somem junto (cascade); os pedidos ficam no histórico da loja, só sem vínculo com a conta.
        const { error } = await db.from("site_users").delete().eq("id", user.id);
        if (error) throw error;
        await db.from("pending_signups").delete().eq("email", user.email);
        return NextResponse.json({ ok: true });
      }

      case "sendTestEmail": {
        const to = String(body.to ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
          return NextResponse.json({ error: "Digite um e-mail válido." }, { status: 400 });
        }
        const settings = await getSiteSettings();
        const appUrl = process.env.APP_URL ?? "http://localhost:3000";
        const now = new Date();
        // Pedido de exemplo (não existe no banco): serve só pra ver o e-mail.
        const order = {
          id: randomUUID(),
          user_id: null,
          customer_name: "Cliente Teste",
          customer_email: to,
          customer_phone: null,
          shipping_address: {},
          shipping_zone_id: null,
          status: "awaiting_payment" as const,
          subtotal_cents: 5990,
          shipping_fee_cents: 900,
          service_fee_cents: 300,
          total_cents: 6290,
          payment_provider: "mercadopago",
          payment_id: null,
          payment_status: "pending",
          pix_qr_code:
            "00020126360014br.gov.bcb.pix0114+5500000000000520400005303986540562.905802BR5915GORDINHODOSPODS6009SAO PAULO62140510TESTE0000163049F2B",
          payment_url: appUrl,
          payment_expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
          order_day: new Date(now.getTime() - BRASILIA_OFFSET_MS).toISOString().slice(0, 10),
          day_number: 1,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        };
        const items = [
          { id: "1", order_id: order.id, product_id: null, product_name: "Pod Descartável 5000 puffs", flavor_id: null, flavor_name: "Menta Gelada", quantity: 1, unit_price_cents: 4990, unit_cost_cents: 0 },
          { id: "2", order_id: order.id, product_id: null, product_name: "Seda Extra Fina", flavor_id: null, flavor_name: null, quantity: 1, unit_price_cents: 1000, unit_cost_cents: 0 },
        ];
        const pix = await sendPixPendingEmail({ order, items, settings });
        if (!pix.sent) return NextResponse.json({ error: `E-mail não enviado: ${pix.error}` }, { status: 502 });
        await sendOrderConfirmationEmail({ order: { ...order, status: "paid" }, items, settings });
        return NextResponse.json({ ok: true });
      }

      case "mpDiagnostics": {
        return NextResponse.json(await mercadoPagoDiagnostics());
      }

      case "whatsappStatus": {
        if (!whatsappAlertConfigured()) return NextResponse.json({ configured: false });
        const result = await getWhatsappStatus();
        return NextResponse.json({ configured: true, qrUrl: whatsappQrPageUrl(), ...result });
      }

      case "sendTestWhatsapp": {
        const to = String(body.to ?? "").replace(/\D/g, "");
        if (to.length < 10) {
          return NextResponse.json({ error: "Digite o WhatsApp da loja com DDD e salve antes de testar." }, { status: 400 });
        }
        // Pedido de exemplo (não existe no banco), no mesmo formato do aviso real.
        const now = new Date();
        const sample = {
          id: randomUUID(),
          user_id: null,
          customer_name: "Cliente Exemplo",
          customer_email: "cliente@exemplo.com",
          customer_phone: "11999990000",
          shipping_address: {
            street: "Rua das Flores",
            number: "123",
            complement: "apto 45",
            neighborhood: "Centro",
            city: "São Paulo",
            state: "SP",
            zip: "01000-000",
          },
          shipping_zone_id: null,
          status: "paid" as const,
          subtotal_cents: 6500,
          shipping_fee_cents: 800,
          service_fee_cents: 325,
          total_cents: 6825,
          payment_provider: "mercadopago",
          payment_id: null,
          payment_status: "approved",
          pix_qr_code: null,
          payment_url: null,
          payment_expires_at: null,
          order_day: new Date(now.getTime() - BRASILIA_OFFSET_MS).toISOString().slice(0, 10),
          day_number: 1,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        };
        const sampleItems = [
          { id: "1", order_id: sample.id, product_id: null, product_name: "Pod Descartável 10K", flavor_id: null, flavor_name: "Melancia com Menta", quantity: 1, unit_price_cents: 6500, unit_cost_cents: null },
        ];
        const result = await sendWhatsappText(
          to,
          `🧪 *MENSAGEM DE TESTE* (pedido de exemplo)\n\n${newOrderAlertText(sample, sampleItems)}`
        );
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
        return NextResponse.json({ ok: true });
      }

      // ---------------- configurações da loja ----------------
      case "getSettings": {
        const { data, error } = await db.from("site_settings").select("key, value");
        if (error) throw error;
        return NextResponse.json({ settings: data });
      }

      case "saveSettings": {
        const updates = pick(body.fields ?? {}, SETTINGS_KEYS);
        const rows = Object.entries(updates).map(([key, value]) => ({
          key,
          value,
          updated_at: new Date().toISOString(),
        }));
        if (rows.length === 0) {
          return NextResponse.json({ error: "Nada para salvar." }, { status: 400 });
        }
        const { error } = await db.from("site_settings").upsert(rows, { onConflict: "key" });
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ---------------- localização da loja (frete) ----------------
      case "locateStoreCep": {
        const place = await locateCep(String(body.cep ?? ""));
        if (!place) {
          return NextResponse.json({ error: "Não encontramos esse CEP no mapa. Confira os números." }, { status: 404 });
        }
        const address = [place.street, place.neighborhood, `${place.city}/${place.state}`].filter(Boolean).join(", ");
        const suggestion = await suggestFreightPricing(place);
        return NextResponse.json({ address, city: place.city, lat: place.lat, lng: place.lng, suggestion });
      }

      // ---------------- upload de imagens ----------------
      case "createUploadUrl": {
        const path: string = body.path;
        if (!path) return NextResponse.json({ error: "path é obrigatório" }, { status: 400 });
        const { data, error } = await db.storage.from("product-images").createSignedUploadUrl(path);
        if (error) throw error;
        return NextResponse.json({ upload: data });
      }

      default:
        return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = getErrorMessage(err, "Erro interno no painel administrativo.");
    const isRead = READ_ACTIONS.has(action);
    // eslint-disable-next-line no-console
    console.error(`[admin:${action}]`, message);
    return NextResponse.json({ error: message }, { status: isRead ? 500 : 400 });
  }
}
