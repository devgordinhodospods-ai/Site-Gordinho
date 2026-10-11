import { NextResponse, type NextRequest } from "next/server";

/**
 * Em produção, quem entra por qualquer endereço que não seja o oficial
 * (APP_URL) vai pra ele, na mesma página: o domínio sem www, o antigo
 * *.vercel.app e o *.up.railway.app. As rotas /api ficam de fora: o Mercado
 * Pago avisa pagamentos de Pix antigos no endereço antigo e não segue
 * redirecionamento, e o cron também pode chamar por lá.
 */
export function middleware(req: NextRequest) {
  const appUrl = process.env.APP_URL;
  if (!appUrl || process.env.NODE_ENV !== "production") return NextResponse.next();

  let target: URL;
  try {
    target = new URL(appUrl);
  } catch {
    return NextResponse.next();
  }
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const hostname = host.split(":")[0];
  // Nunca em loop, e nunca rodando local (localhost/IP).
  if (
    !hostname ||
    host === target.host ||
    hostname === target.hostname ||
    hostname === "localhost" ||
    /^[\d.]+$/.test(hostname) ||
    ["localhost", "127.0.0.1"].includes(target.hostname)
  ) {
    return NextResponse.next();
  }

  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, target.origin);
  // 307 (temporário): o navegador não grava o redirecionamento, então dá pra
  // trocar de domínio de novo sem ninguém ficar preso no endereço antigo.
  return NextResponse.redirect(url, 307);
}

export const config = {
  // Tudo menos /api e os arquivos internos do Next.
  matcher: ["/((?!api/|_next/|favicon.ico).*)"],
};
