import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { computeDynamicShippingFee } from "@/lib/shipping";
import { getSiteSettings } from "@/lib/settings";

const schema = z.object({ zoneId: z.string().uuid() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "zoneId inválido" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: zone } = await db
    .from("shipping_zones")
    .select("id, name, base_fee_cents, km_from_origin")
    .eq("id", parsed.data.zoneId)
    .eq("active", true)
    .maybeSingle();

  if (!zone) {
    return NextResponse.json({ error: "Região de entrega não encontrada" }, { status: 404 });
  }

  const settings = await getSiteSettings();

  const breakdown = await computeDynamicShippingFee({
    zone,
    originLat: settings.origin_lat,
    originLng: settings.origin_lng,
  });

  return NextResponse.json({ zone, breakdown });
}
