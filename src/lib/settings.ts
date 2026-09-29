import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: SiteSettings = {
  store_name: "Minha Loja",
  store_logo_url: null,
  store_favicon_url: null,
  footer_image_url: null,
  contact_whatsapp: null,
  contact_email: null,
  contact_instagram: null,
  origin_cep: null,
  origin_address: null,
  origin_lat: null,
  origin_lng: null,
  shipping_base_fee_cents: 500,
  shipping_per_km_cents: 150,
  shipping_max_km: 15,
  service_fee_percent: 5,
  service_fee_fixed: 0,
  announcement_text: "Compra 100% segura • Pagamento via Pix",
  hero_image_url: null,
  hero_images: [],
  hero_images_mobile: [],
  whatsapp_alert_number: null,
  closed_popup_enabled: false,
  closed_days: [0],
  open_time: null,
  close_time: null,
  closed_manual: false,
  closed_popup_title: "Estamos fechados agora",
  closed_popup_message:
    "Mas pode comprar tranquilo: seu pedido fica registrado e será entregue {proximo_dia}.",
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

/** Imagens do banner da vitrine (lista nova ou, em lojas antigas, a imagem única). */
export function heroImages(settings: Pick<SiteSettings, "hero_images" | "hero_image_url">): string[] {
  const list = Array.isArray(settings.hero_images) ? settings.hero_images.filter(Boolean) : [];
  if (list.length > 0) return list;
  return settings.hero_image_url ? [settings.hero_image_url] : [];
}
