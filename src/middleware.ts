import { NextResponse, type NextRequest } from "next/server";

/**
 * Quem entra pelo endereço antigo da Vercel (*.vercel.app) em produção vai
 * pro domínio oficial (APP_URL), na mesma página. As rotas /api ficam de
 * fora: o Mercado Pago avisa pagamentos de Pix antigos no endereço antigo e
 * não segue redirecionamento, e o cron também chama por lá.
 */
export function middleware(req: NextRequest) {
  const appUrl = process.env.APP_URL;
  if (!appUrl || process.env.VERCEL_ENV !== "production") return NextResponse.next();

  let target: URL;
  try {
    target = new URL(appUrl);
  } catch {
    return NextResponse.next();
  }
  const host = (req.headers.get("host") ?? "").toLowerCase();
  // Só redireciona do .vercel.app pro domínio próprio (nunca em loop).
  if (!host.endsWith(".vercel.app") || target.hostname.endsWith(".vercel.app") || host === target.host) {
    return NextResponse.next();
  }

  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, target.origin);
  // 307 (temporário): o navegador não grava o redirecionamento, então se o
  // domínio novo ainda não estiver no ar, basta voltar a APP_URL.
  return NextResponse.redirect(url, 307);
}

export const config = {
  // Tudo menos /api e os arquivos internos do Next.
  matcher: ["/((?!api/|_next/|favicon.ico).*)"],
};
