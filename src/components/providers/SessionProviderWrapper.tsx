"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { CartAccountSync } from "@/components/providers/CartAccountSync";
import { AccountRemovedGuard } from "@/components/providers/AccountRemovedGuard";

export function SessionProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CartAccountSync />
      <AccountRemovedGuard />
      {children}
    </SessionProvider>
  );
}
