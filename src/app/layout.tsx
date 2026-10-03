import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/providers/SessionProviderWrapper";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { getSiteSettings } from "@/lib/settings";
import { ClosedStorePopup } from "@/components/layout/ClosedStorePopup";
import { RecaptchaLoader } from "@/components/layout/RecaptchaLoader";

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
    title: { default: settings.store_name, template: `%s | ${settings.store_name}` },
    description: `Loja online ${settings.store_name}`,
    icons: settings.store_favicon_url ? [{ url: settings.store_favicon_url }] : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();

  return (
    <html lang="pt-BR" className={lato.variable} suppressHydrationWarning>
      <head>
        {/* Aplica o modo escuro salvo antes da página aparecer (sem piscar). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <SessionProviderWrapper>
          <AnnouncementBar text={settings.announcement_text} />
          <Navbar storeName={settings.store_name} logoUrl={settings.store_logo_url} />
          <main className="flex-1">{children}</main>
          <Footer settings={settings} />
          <RecaptchaLoader />
          <ClosedStorePopup
            settings={{
              closed_popup_enabled: settings.closed_popup_enabled,
              closed_days: settings.closed_days,
              open_time: settings.open_time,
              close_time: settings.close_time,
              closed_manual: settings.closed_manual,
              closed_popup_title: settings.closed_popup_title,
              closed_popup_message: settings.closed_popup_message,
            }}
          />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
