import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { sendOrderStatusUpdateEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/settings";
import { getErrorMessage } from "@/lib/errors";
import type { OrderStatus } from "@/lib/types";

const READ_ACTIONS = new Set([
  "listProducts",
  "listCategories",
  "listShippingZones",
  "listOrders",
  "getOrder",
  "getSettings",
  "getDashboardStats",
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

const SHIPPING_ZONE_FIELDS = [
  "name",
  "cities",
  "neighborhoods",
  "base_fee_cents",
  "km_from_origin",
  "active",
] as const;

const SETTINGS_KEYS = [
  "store_name",
  "store_logo_url",
  "store_favicon_url",
  "contact_whatsapp",
  "contact_email",
  "contact_instagram",
  "origin_address",
  "origin_lat",
  "origin_lng",
  "service_fee_percent",
  "service_fee_fixed",
  "announcement_text",
  "hero_title",
  "hero_subtitle",
] as const;

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

        // Sabores: a lista enviada pelo painel é sempre a lista completa
        // atual, então substitui tudo (apaga o que sumiu, grava o resto).
        if (Array.isArray(body.flavors)) {
          const { error: delError } = await db
            .from("product_flavors")
            .delete()
            .eq("product_id", productId);
          if (delError) throw delError;

          const flavorRows = body.flavors.map((f: Record<string, unknown>, index: number) => ({
            ...pick(f, FLAVOR_FIELDS),
            position: index,
            product_id: productId,
          }));

          if (flavorRows.length > 0) {
            const { error: insError } = await db.from("product_flavors").insert(flavorRows);
            if (insError) throw insError;
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

      // ---------------- regiões de entrega ----------------
      case "listShippingZones": {
        const { data, error } = await db.from("shipping_zones").select("*").order("name");
        if (error) throw error;
        return NextResponse.json({ zones: data });
      }

      case "saveShippingZone": {
        const fields = pick(body.fields ?? {}, SHIPPING_ZONE_FIELDS);
        if (body.id) {
          const { data, error } = await db
            .from("shipping_zones")
            .update(fields)
            .eq("id", body.id)
            .select()
            .single();
          if (error) throw error;
          return NextResponse.json({ zone: data });
        }
        const { data, error } = await db.from("shipping_zones").insert(fields).select().single();
        if (error) throw error;
        return NextResponse.json({ zone: data });
      }

      case "deleteShippingZone": {
        const { error } = await db.from("shipping_zones").delete().eq("id", body.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ---------------- dashboard de monitoramento ----------------
      case "getDashboardStats": {
        const { data: orders, error: ordersError } = await db
          .from("orders")
          .select("id, status, total_cents, created_at");
        if (ordersError) throw ordersError;

        const { data: items, error: itemsError } = await db
          .from("order_items")
          .select("order_id, product_id, product_name, quantity, unit_price_cents, unit_cost_cents");
        if (itemsError) throw itemsError;

        const orderById = new Map((orders ?? []).map((o) => [o.id, o]));

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let totalVendidoCents = 0;
        let lucroTotalCents = 0;
        let pedidosPagos = 0;
        let pedidosPendentes = 0;
        let pedidosCancelados = 0;

        const periodStats = {
          today: { vendasCents: 0, lucroCents: 0 },
          week: { vendasCents: 0, lucroCents: 0 },
          month: { vendasCents: 0, lucroCents: 0 },
        };

        for (const o of orders ?? []) {
          const createdAt = new Date(o.created_at);
          if (PAID_LIKE_STATUSES.has(o.status)) {
            totalVendidoCents += o.total_cents;
            pedidosPagos += 1;
            if (createdAt >= startOfDay) periodStats.today.vendasCents += o.total_cents;
            if (createdAt >= startOfWeek) periodStats.week.vendasCents += o.total_cents;
            if (createdAt >= startOfMonth) periodStats.month.vendasCents += o.total_cents;
          } else if (o.status === "awaiting_payment") {
            pedidosPendentes += 1;
          } else if (o.status === "cancelled") {
            pedidosCancelados += 1;
          }
        }

        type ProductAgg = { name: string; quantity: number; receitaCents: number; lucroCents: number };
        const productAgg = new Map<string, ProductAgg>();

        for (const item of items ?? []) {
          const order = orderById.get(item.order_id);
          if (!order || !PAID_LIKE_STATUSES.has(order.status)) continue;

          const cost = item.unit_cost_cents ?? 0;
          const itemLucro = (item.unit_price_cents - cost) * item.quantity;
          const itemReceita = item.unit_price_cents * item.quantity;
          lucroTotalCents += itemLucro;

          const createdAt = new Date(order.created_at);
          if (createdAt >= startOfDay) periodStats.today.lucroCents += itemLucro;
          if (createdAt >= startOfWeek) periodStats.week.lucroCents += itemLucro;
          if (createdAt >= startOfMonth) periodStats.month.lucroCents += itemLucro;

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

        const topProducts = Array.from(productAgg.values())
          .sort((a, b) => b.receitaCents - a.receitaCents)
          .slice(0, 10)
          .map((p) => ({
            ...p,
            margemPercent: p.receitaCents > 0 ? (p.lucroCents / p.receitaCents) * 100 : 0,
          }));

        return NextResponse.json({
          totalVendidoCents,
          lucroTotalCents,
          margemPercent: totalVendidoCents > 0 ? (lucroTotalCents / totalVendidoCents) * 100 : 0,
          totalPedidos: (orders ?? []).length,
          pedidosPagos,
          pedidosPendentes,
          pedidosCancelados,
          ticketMedioCents: pedidosPagos > 0 ? Math.round(totalVendidoCents / pedidosPagos) : 0,
          periodStats,
          topProducts,
        });
      }

      // ---------------- pedidos ----------------
      case "listOrders": {
        let query = db
          .from("orders")
          .select("*, order_items(*)")
          .order("created_at", { ascending: false });
        if (body.status) query = query.eq("status", body.status);
        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ orders: data });
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

        if (status === "cancelled") {
          const { error: cancelError } = await db.rpc("cancel_order", { p_order_id: body.id });
          if (cancelError) throw cancelError;
        } else {
          const { error } = await db
            .from("orders")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("id", body.id);
          if (error) throw error;
        }

        const { data: order } = await db.from("orders").select("*").eq("id", body.id).single();
        if (order) {
          const settings = await getSiteSettings();
          await sendOrderStatusUpdateEmail({ order, settings }).catch(() => null);
        }

        return NextResponse.json({ order });
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

      // ---------------- geocodificação do endereço de origem ----------------
      case "geocodeAddress": {
        const address: string = body.address;
        if (!address) return NextResponse.json({ error: "address é obrigatório" }, { status: 400 });

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
          { headers: { "User-Agent": "site-gordinho-ecommerce/1.0" } }
        );
        const results = await res.json();
        if (!Array.isArray(results) || results.length === 0) {
          return NextResponse.json({ error: "Endereço não encontrado." }, { status: 404 });
        }
        return NextResponse.json({ lat: Number(results[0].lat), lng: Number(results[0].lon) });
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
