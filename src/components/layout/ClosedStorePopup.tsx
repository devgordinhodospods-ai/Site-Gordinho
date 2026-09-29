"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bike, Moon } from "lucide-react";
import { closedMessage, getStoreStatus, type StoreHoursSettings } from "@/lib/storeHours";

const SEEN_KEY = "closed-popup-seen";

/** Cartão do aviso de loja fechada — usado no site e na prévia do painel. */
export function ClosedStoreCard({
  title,
  message,
  nextOpen,
  onClose,
}: {
  title: string;
  message: string;
  nextOpen: string;
  onClose?: () => void;
}) {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div
        className="relative flex flex-col items-center px-6 pb-6 pt-8 text-center text-white"
        style={{ background: "linear-gradient(160deg, #0f2f8f 0%, #1d4ed8 60%, #3b82f6 100%)" }}
      >
        <span className="absolute left-6 top-5 h-1.5 w-1.5 rounded-full bg-white/60" />
        <span className="absolute right-10 top-8 h-1 w-1 rounded-full bg-white/50" />
        <span className="absolute bottom-6 left-12 h-1 w-1 rounded-full bg-white/40" />
        <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/10">
          <Moon size={30} className="fill-yellow-200 text-yellow-200" />
        </span>
        <h2 className="font-display text-2xl leading-tight">{title}</h2>
      </div>
      <div className="px-6 pb-6 pt-5 text-center">
        <p className="text-sm leading-relaxed text-slate-600">{message}</p>
        <p className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm text-brand">
          <Bike size={16} /> Entrega {nextOpen}
        </p>
        <button type="button" className="btn-primary mt-5 w-full" onClick={onClose}>
          Entendi, quero ver os produtos
        </button>
      </div>
    </div>
  );
}

/**
 * Popup de "loja fechada": aparece uma vez por dia (por navegador) quando o
 * cliente abre o site num dia/horário em que a loja não funciona.
 */
export function ClosedStorePopup({ settings }: { settings: StoreHoursSettings }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ReturnType<typeof getStoreStatus>>({ closed: false });

  useEffect(() => {
    // Calculado no navegador: depende da hora atual.
    const current = getStoreStatus(settings);
    setStatus(current);
    if (!current.closed) return;
    const seenValue = `${current.dateKey}-${current.reason}`;
    try {
      if (localStorage.getItem(SEEN_KEY) === seenValue) return;
    } catch {
      // sem localStorage: mostra mesmo assim
    }
    setOpen(true);
  }, [settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    if (status.closed) {
      try {
        localStorage.setItem(SEEN_KEY, `${status.dateKey}-${status.reason}`);
      } catch {
        // ignora
      }
    }
  }

  if (!open || !status.closed || pathname.startsWith("/admin")) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-[popIn_.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
        <ClosedStoreCard
          title={settings.closed_popup_title || "Estamos fechados agora"}
          message={closedMessage(settings, status.nextOpen)}
          nextOpen={status.nextOpen}
          onClose={close}
        />
      </div>
    </div>
  );
}
