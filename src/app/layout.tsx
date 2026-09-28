import type { Metadata } from "next";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/providers/SessionProviderWrapper";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getSiteSettings } from "@/lib/settings";

// A loja troca nome/logo/catálogo pelo painel admin a qualquer momento, então
// renderizamos tudo sob demanda em vez de gerar páginas estáticas no build
// (isso também evita que o build falhe quando as credenciais do Supabase
// ainda não foram configuradas no ambiente).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: settings.store_name,
    description: `Loja online ${settings.store_name}`,
    icons: settings.store_favicon_url ? [{ url: settings.store_favicon_url }] : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col">
        <SessionProviderWrapper>
          <Navbar storeName={settings.store_name} logoUrl={settings.store_logo_url} />
          <main className="flex-1">{children}</main>
          <Footer settings={settings} />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
