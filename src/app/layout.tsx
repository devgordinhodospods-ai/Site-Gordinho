import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/providers/SessionProviderWrapper";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { getSiteSettings } from "@/lib/settings";
import { getActiveCategories } from "@/lib/categories";

const lato = Lato({
  subsets: ["latin"],
  // Site inteiro usa Lato Black (900) — ver tailwind.config.ts, que remapeia
  // todas as utilidades de peso pra 900.
  weight: ["900"],
  variable: "--font-lato",
  display: "swap",
});

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
  const [settings, categories] = await Promise.all([getSiteSettings(), getActiveCategories()]);

  return (
    <html lang="pt-BR" className={lato.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <SessionProviderWrapper>
          <AnnouncementBar text={settings.announcement_text} />
          <Navbar storeName={settings.store_name} logoUrl={settings.store_logo_url} categories={categories} />
          <main className="flex-1">{children}</main>
          <Footer settings={settings} />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
