import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/settings";

/**
 * Navegadores pedem /favicon.ico por conta própria. Manda pro favicon (ou a
 * logo) cadastrado no painel; sem nenhum, responde vazio em vez de 404.
 */
export async function GET(req: Request) {
  const settings = await getSiteSettings();
  const icon = settings.store_favicon_url || settings.store_logo_url;
  if (icon) return NextResponse.redirect(new URL(icon, req.url), 302);
  return new NextResponse(null, { status: 204 });
}
