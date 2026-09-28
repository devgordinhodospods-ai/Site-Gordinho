import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { computeDynamicShippingFee, lookupCep, matchShippingZone } from "@/lib/shipping";
import { getSiteSettings } from "@/lib/settings";

const schema = z.object({ cep: z.string().min(8) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "CEP inválido." }, { status: 400 });
  }

  const location = await lookupCep(parsed.data.cep);
  if (!location) {
    return NextResponse.json({ error: "CEP não encontrado." }, { status: 404 });
  }

  const db = getSupabaseAdmin();
  const { data: zones } = await db
    .from("shipping_zones")
    .select("id, name, cities, neighborhoods, base_fee_cents, km_from_origin")
    .eq("active", true);

  const zone = matchShippingZone(zones ?? [], location);
  if (!zone) {
    return NextResponse.json(
      { error: "Ainda não entregamos nessa região. Fale com a gente pelo WhatsApp pra confirmar." },
      { status: 404 }
    );
  }

  const settings = await getSiteSettings();
  const breakdown = await computeDynamicShippingFee({
    zone,
    originLat: settings.origin_lat,
    originLng: settings.origin_lng,
  });

  return NextResponse.json({ zoneName: zone.name, city: location.city, breakdown });
}
