import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: SiteSettings = {
  store_name: "Minha Loja",
  store_logo_url: null,
  store_favicon_url: null,
  contact_whatsapp: null,
  contact_email: null,
  contact_instagram: null,
  origin_address: null,
  origin_lat: null,
  origin_lng: null,
  service_fee_percent: 5,
  service_fee_fixed: 0,
  announcement_text: "Compra 100% segura • Pagamento via Mercado Pago",
  hero_title: null,
  hero_subtitle: null,
};

/**
 * Lê as configurações públicas do site (nome/logo/contato) direto do banco.
 * Usado no servidor (layout, navbar, footer) — sempre com fallback seguro,
 * pois a loja pode ainda não ter configurado nada.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("site_settings")
      .select("key, value")
      .in("key", Object.keys(DEFAULT_SETTINGS));

    if (error || !data) return DEFAULT_SETTINGS;

    const merged = { ...DEFAULT_SETTINGS };
    for (const row of data) {
      (merged as Record<string, unknown>)[row.key] = row.value;
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
