"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";

/** Desloga na hora quem teve a conta excluída pelo painel de admin. */
export function AccountRemovedGuard() {
  const { data: session } = useSession();
  const removed = session?.user?.removed;

  useEffect(() => {
    if (removed) signOut({ callbackUrl: "/" });
  }, [removed]);

  return null;
}
