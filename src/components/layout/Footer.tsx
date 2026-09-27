import Image from "next/image";
import Link from "next/link";
import type { SiteSettings } from "@/lib/types";

export function Footer({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-900 text-neutral-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            {settings.store_logo_url ? (
              <Image
                src={settings.store_logo_url}
                alt={settings.store_name}
                width={32}
                height={32}
                className="rounded"
              />
            ) : null}
            <span>{settings.store_name}</span>
          </div>
          <p className="text-sm">
            © {new Date().getFullYear()} {settings.store_name}. Todos os direitos reservados.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Contato</h3>
          <ul className="space-y-1 text-sm">
            {settings.contact_whatsapp && <li>WhatsApp: {settings.contact_whatsapp}</li>}
            {settings.contact_email && <li>E-mail: {settings.contact_email}</li>}
            {settings.contact_instagram && <li>Instagram: {settings.contact_instagram}</li>}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Loja</h3>
          <ul className="space-y-1 text-sm">
            <li><Link href="/produtos" className="hover:text-white">Produtos</Link></li>
            <li><Link href="/pedidos" className="hover:text-white">Meus pedidos</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
