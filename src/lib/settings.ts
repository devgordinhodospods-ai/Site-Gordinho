import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteSettings } from "@/lib/types";

export const SITE_SETTINGS_TAG = "site-settings";

export const DEFAULT_SETTINGS: SiteSettings = {
  store_name: "Minha Loja",
  store_logo_url: null,
  store_favicon_url: null,
  footer_image_url: null,
  contact_whatsapp: null,
  contact_email: null,
  contact_instagram: null,
  origin_address: null,
  origin_lat: null,
  origin_lng: null,
  service_fee_percent: 5,
  service_fee_fixed: 0,
  announcement_text: "Compra 100% segura • Pagamento via Mercado Pago",
  hero_image_url: null,
};

async function fetchSiteSettings(): Promise<SiteSettings> {
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
}

// site_settings é lida em praticamente toda página (navbar/rodapé) e em
// quase toda rota da API, mas muda raramente (só quando o admin salva
// configurações). Cacheia por 60s e invalida na hora via revalidateTag
// quando o admin salva, em vez de bater no banco a cada request.
const getCachedSiteSettings = unstable_cache(fetchSiteSettings, ["site-settings"], {
  tags: [SITE_SETTINGS_TAG],
  revalidate: 60,
});

/**
 * Lê as configurações públicas do site (nome/logo/contato) direto do banco.
 * Usado no servidor (layout, navbar, footer) — sempre com fallback seguro,
 * pois a loja pode ainda não ter configurado nada.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return await getCachedSiteSettings();
  } catch {
    return DEFAULT_SETTINGS;
  }
}
