import { lookupCep, type CepLookup } from "@/lib/cep";

export type GeoPoint = { lat: number; lng: number };
export type LocatedCep = CepLookup & GeoPoint;

const USER_AGENT = "loja-ecommerce/1.0 (estimativa de frete)";
const DAY = 60 * 60 * 24;

async function nominatim(params: Record<string, string>): Promise<GeoPoint | null> {
  try {
    const qs = new URLSearchParams({ format: "json", limit: "1", countrycodes: "br", ...params });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: DAY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  } catch {
    return null;
  }
}

async function brasilApiCoords(digits: string): Promise<GeoPoint | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, { next: { revalidate: DAY } });
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.location?.coordinates;
    const lat = Number(coords?.latitude);
    const lng = Number(coords?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/**
 * Descobre endereço e coordenadas de um CEP: ViaCEP pro endereço, BrasilAPI
 * pras coordenadas e, se ela não tiver, o OpenStreetMap (rua → bairro →
 * cidade, do mais preciso pro menos). Tudo gratuito e sem chave.
 */
export async function locateCep(cep: string): Promise<LocatedCep | null> {
  const digits = cep.replace(/\D/g, "");
  const address = await lookupCep(digits);
  if (!address) return null;

  const point =
    (await brasilApiCoords(digits)) ??
    (address.street
      ? await nominatim({ street: address.street, city: address.city, state: address.state })
      : null) ??
    (address.neighborhood ? await nominatim({ q: `${address.neighborhood}, ${address.city}, ${address.state}` }) : null) ??
    (await nominatim({ city: address.city, state: address.state }));

  return point ? { ...address, ...point } : null;
}

/** Distância em linha reta entre dois pontos, em km. */
export function distanceKm(a: GeoPoint, b: GeoPoint) {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Linha reta é menor que o caminho de moto pelas ruas; esse fator aproxima.
const ROAD_FACTOR = 1.3;

export type FreightEstimate =
  | { status: "ok"; km: number; feeCents: number; city: string }
  | { status: "out_of_range"; km: number; maxKm: number; city: string }
  | { status: "unavailable" };

export async function estimateFreight(
  cep: string,
  settings: {
    origin_lat: number | null;
    origin_lng: number | null;
    shipping_base_fee_cents: number;
    shipping_per_km_cents: number;
    shipping_max_km: number;
  }
): Promise<FreightEstimate> {
  if (settings.origin_lat == null || settings.origin_lng == null) return { status: "unavailable" };
  const place = await locateCep(cep);
  if (!place) return { status: "unavailable" };

  const km = Math.round(distanceKm({ lat: settings.origin_lat, lng: settings.origin_lng }, place) * ROAD_FACTOR * 10) / 10;
  if (settings.shipping_max_km > 0 && km > settings.shipping_max_km) {
    return { status: "out_of_range", km, maxKm: settings.shipping_max_km, city: place.city };
  }
  const feeCents = settings.shipping_base_fee_cents + Math.round(km * settings.shipping_per_km_cents);
  return { status: "ok", km, feeCents, city: place.city };
}

export type PricingSuggestion = {
  tier: string;
  population: number | null;
  baseFeeCents: number;
  perKmCents: number;
  maxKm: number;
};

// Faixas de preço de entrega por moto conforme o porte da cidade — valores
// típicos de mercado, pensados como ponto de partida pro operador ajustar.
// Ex.: cidade de ~100 mil habitantes → corrida de 2–3 km fica entre R$ 8 e R$ 10.
const TIERS: { upTo: number; tier: string; baseFeeCents: number; perKmCents: number; maxKm: number }[] = [
  { upTo: 50_000, tier: "cidade pequena", baseFeeCents: 500, perKmCents: 100, maxKm: 8 },
  { upTo: 200_000, tier: "cidade média", baseFeeCents: 600, perKmCents: 120, maxKm: 12 },
  { upTo: 1_000_000, tier: "cidade grande", baseFeeCents: 700, perKmCents: 150, maxKm: 15 },
  { upTo: 5_000_000, tier: "capital / metrópole", baseFeeCents: 800, perKmCents: 180, maxKm: 20 },
  { upTo: Infinity, tier: "metrópole (SP/RJ)", baseFeeCents: 900, perKmCents: 200, maxKm: 25 },
];

/** População estimada do município pelo IBGE (API pública, sem chave). */
async function ibgePopulation(ibgeCode: string): Promise<number | null> {
  if (!/^\d{7}$/.test(ibgeCode)) return null;
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${ibgeCode}]`,
      { next: { revalidate: DAY * 30 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const serie = data?.[0]?.resultados?.[0]?.series?.[0]?.serie;
    const value = serie ? Number(Object.values(serie)[0]) : NaN;
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function suggestFreightPricing(place: Pick<LocatedCep, "ibge">): Promise<PricingSuggestion> {
  const population = await ibgePopulation(place.ibge);
  // Sem dado do IBGE, usa a faixa de cidade média (o caso mais comum).
  const tier = TIERS.find((t) => (population ?? 100_000) <= t.upTo) ?? TIERS[1];
  return {
    tier: tier.tier,
    population,
    baseFeeCents: tier.baseFeeCents,
    perKmCents: tier.perKmCents,
    maxKm: tier.maxKm,
  };
}
