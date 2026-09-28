import Image from "next/image";
import Link from "next/link";
import { Instagram, Mail, MessageCircle } from "lucide-react";
import type { SiteSettings } from "@/lib/types";

function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/55${digits}`;
}

function instagramLink(handle: string) {
  const clean = handle.replace(/^@/, "").trim();
  return `https://instagram.com/${clean}`;
}

export function Footer({ settings }: { settings: SiteSettings }) {
  const image = settings.footer_image_url ?? settings.store_logo_url;
  const contactHref = settings.contact_whatsapp
    ? whatsappLink(settings.contact_whatsapp)
    : settings.contact_email
      ? `mailto:${settings.contact_email}`
      : null;

  const socialLinks = [
    settings.contact_instagram && {
      icon: Instagram,
      label: "Instagram",
      href: instagramLink(settings.contact_instagram),
    },
    settings.contact_whatsapp && {
      icon: MessageCircle,
      label: "WhatsApp",
      href: whatsappLink(settings.contact_whatsapp),
    },
    settings.contact_email && {
      icon: Mail,
      label: "E-mail",
      href: `mailto:${settings.contact_email}`,
    },
  ].filter(Boolean) as { icon: typeof Instagram; label: string; href: string }[];

  return (
    <footer className="mt-16 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:text-left">
          {image ? (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-700">
              <Image src={image} alt={settings.store_name} fill className="object-cover" />
            </div>
          ) : null}
          <span className="font-display text-xl text-white">{settings.store_name}</span>
        </div>

        <div>
          <h3 className="font-display mb-3 text-sm uppercase tracking-wide text-white">Navegação</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/" className="transition hover:text-white">
                Início
              </Link>
            </li>
            <li>
              <Link href="/produtos" className="transition hover:text-white">
                Catálogo
              </Link>
            </li>
            <li>
              {contactHref ? (
                <a href={contactHref} target="_blank" rel="noreferrer" className="transition hover:text-white">
                  Contato
                </a>
              ) : (
                <span className="text-slate-500">Contato</span>
              )}
            </li>
            <li>
              <Link href="/pedidos" className="transition hover:text-white">
                Meus pedidos
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-display mb-3 text-sm uppercase tracking-wide text-white">Redes sociais</h3>
          {socialLinks.length > 0 ? (
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-slate-300 transition hover:border-brand hover:text-white"
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nenhum contato configurado ainda.</p>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800 px-4 py-5 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} {settings.store_name}. Todos os direitos reservados.
      </div>
    </footer>
  );
}
