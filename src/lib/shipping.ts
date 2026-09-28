import type { ShippingZone } from "@/lib/types";

/**
 * Motor de frete dinâmico.
 *
 * A tabacaria usa entregadores via 99 (frete "sob demanda"), cujo preço real
 * só existe dentro do app deles na hora da corrida — não há API pública de
 * cotação para lojistas comuns. Para dar uma experiência parecida (preço que
 * sobe em horário de pico e quando chove) sem depender de um contrato/API
 * privada da 99, este motor simula a mesma lógica com regras configuráveis:
 *
 *   preço final = (taxa base da região + R$/km * distância)
 *                 × multiplicador de horário de pico
 *                 × multiplicador de chuva (clima real, via Open-Meteo)
 *
 * Quando a loja conseguir acesso a uma cotação real (API de entrega da 99,
 * Lalamove, Loggi etc.), basta trocar `computeDynamicShippingFee` por uma
 * chamada a essa API e manter a mesma assinatura de retorno.
 */

const CENTS_PER_KM = 150; // R$ 1,50 por km rodado a partir da origem
const PEAK_SURGE_MULTIPLIER = 1.25; // +25% em horário de pico
const RAIN_SURGE_MULTIPLIER = 1.3; // +30% quando está chovendo na origem
const LATE_NIGHT_SURGE_MULTIPLIER = 1.15; // +15% de madrugada (menos entregadores)
const MAX_TOTAL_MULTIPLIER = 1.7; // trava de segurança contra preço absurdo

export type ShippingBreakdown = {
  baseFeeCents: number;
  distanceFeeCents: number;
  subtotalCents: number;
  peakHour: boolean;
  raining: boolean;
  lateNight: boolean;
  appliedMultiplier: number;
  totalCents: number;
};

function isPeakHour(date: Date): boolean {
  const h = date.getHours() + date.getMinutes() / 60;
  const lunch = h >= 11.5 && h <= 14;
  const dinner = h >= 18 && h <= 21;
  return lunch || dinner;
}

function isLateNight(date: Date): boolean {
  const h = date.getHours();
  return h >= 22 || h < 6;
}

/**
 * Consulta o clima atual na origem (loja) via Open-Meteo — API pública,
 * gratuita e sem necessidade de chave. Falha de forma segura: se a consulta
 * der erro, assume que não está chovendo (não bloqueia o checkout).
 */
export async function isRainingAtOrigin(
  lat: number | null,
  lng: number | null
): Promise<boolean> {
  if (lat == null || lng == null) return false;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,rain,weather_code`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return false;
    const data = await res.json();
    const precipitation = data?.current?.precipitation ?? 0;
    const rain = data?.current?.rain ?? 0;
    return precipitation > 0 || rain > 0;
  } catch {
    return false;
  }
}

export async function computeDynamicShippingFee(params: {
  zone: Pick<ShippingZone, "base_fee_cents" | "km_from_origin">;
  originLat: number | null;
  originLng: number | null;
  now?: Date;
}): Promise<ShippingBreakdown> {
  const now = params.now ?? new Date();
  const distanceFeeCents = Math.round(params.zone.km_from_origin * CENTS_PER_KM);
  const subtotalCents = params.zone.base_fee_cents + distanceFeeCents;

  const peakHour = isPeakHour(now);
  const lateNight = isLateNight(now);
  const raining = await isRainingAtOrigin(params.originLat, params.originLng);

  let multiplier = 1;
  if (peakHour) multiplier *= PEAK_SURGE_MULTIPLIER;
  if (raining) multiplier *= RAIN_SURGE_MULTIPLIER;
  if (lateNight) multiplier *= LATE_NIGHT_SURGE_MULTIPLIER;
  multiplier = Math.min(multiplier, MAX_TOTAL_MULTIPLIER);

  const totalCents = Math.round(subtotalCents * multiplier);

  return {
    baseFeeCents: params.zone.base_fee_cents,
    distanceFeeCents,
    subtotalCents,
    peakHour,
    raining,
    lateNight,
    appliedMultiplier: Number(multiplier.toFixed(2)),
    totalCents,
  };
}

export function computeServiceFee(params: {
  subtotalCents: number;
  percent: number;
  fixedCents: number;
}): number {
  const percentPart = Math.round((params.subtotalCents * params.percent) / 100);
  return percentPart + params.fixedCents;
}
