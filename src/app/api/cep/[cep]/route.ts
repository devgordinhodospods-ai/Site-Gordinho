import { NextResponse } from "next/server";
import { lookupCep } from "@/lib/cep";

export async function GET(_req: Request, { params }: { params: Promise<{ cep: string }> }) {
  const { cep } = await params;
  const address = await lookupCep(cep);
  if (!address) return NextResponse.json({ error: "CEP não encontrado." }, { status: 404 });
  return NextResponse.json({ address });
}
