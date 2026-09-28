"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { CartAccountSync } from "@/components/providers/CartAccountSync";

export function SessionProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CartAccountSync />
      {children}
    </SessionProvider>
  );
}
