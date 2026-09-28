"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * Link que, quando o usuário já está na página de destino, rola suavemente
 * até o topo em vez de "saltar". O Next.js desliga scroll-behavior: smooth
 * durante navegações, então o CSS sozinho não resolve.
 */
export function SmoothTopLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (pathname === href) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }}
      {...props}
    />
  );
}
