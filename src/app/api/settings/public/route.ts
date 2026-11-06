import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/settings";

export async function GET() {
  const settings = await getSiteSettings();
  return NextResponse.json({
    storeName: settings.store_name,
    serviceFeePercent: settings.service_fee_percent,
    serviceFeeFixed: settings.service_fee_fixed,
    paymentMode: ["whatsapp", "infinitepay"].includes(settings.payment_mode) ? settings.payment_mode : "pix",
    // Número que recebe os pedidos no modo WhatsApp (o de contato da loja,
    // ou o dos avisos, se não tiver).
    orderWhatsapp: (settings.contact_whatsapp || settings.whatsapp_alert_number || "").replace(/\D/g, "") || null,
  });
}
