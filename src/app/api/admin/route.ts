import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { sendOrderStatusUpdateEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/settings";
import type { OrderStatus } from "@/lib/types";

const READ_ACTIONS = new Set([
  "listProducts",
  "listCategories",
  "listShippingZones",
  "listOrders",
  "getOrder",
  "getSettings",
]);

const PRODUCT_FIELDS = [
  "name",
  "slug",
  "description",
  "price_cents",
  "compare_at_price_cents",
  "images",
  "category_id",
  "stock",
  "active",
] as const;

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
          .select("*, categories(id, name)")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ products: data });
      }

      case "saveProduct": {
        const fields = pick(body.fields ?? {}, PRODUCT_FIELDS);
        if (body.id) {
          const { data, error } = await db
            .from("products")
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq("id", body.id)
            .select()
            .single();
          if (error) throw error;
          return NextResponse.json({ product: data });
        }
        const { data, error } = await db.from("products").insert(fields).select().single();
        if (error) throw error;
        return NextResponse.json({ product: data });
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
    const message = err instanceof Error ? err.message : "Erro interno no painel administrativo.";
    const isRead = READ_ACTIONS.has(action);
    // eslint-disable-next-line no-console
    console.error(`[admin:${action}]`, message);
    return NextResponse.json({ error: message }, { status: isRead ? 500 : 400 });
  }
}
