import { NextResponse } from "next/server";
import { estimateFreight } from "@/lib/geo";
import { getSiteSettings } from "@/lib/settings";

export async function GET(req: Request) {
  const cep = new URL(req.url).searchParams.get("cep") ?? "";
  if (cep.replace(/\D/g, "").length !== 8) {
    return NextResponse.json({ error: "CEP inválido." }, { status: 400 });
  }
  const estimate = await estimateFreight(cep, await getSiteSettings());
  return NextResponse.json({ estimate });
}
