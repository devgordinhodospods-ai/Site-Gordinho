import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/settings";

export async function GET() {
  const settings = await getSiteSettings();
  return NextResponse.json({
    storeName: settings.store_name,
    serviceFeePercent: settings.service_fee_percent,
    serviceFeeFixed: settings.service_fee_fixed,
  });
}
