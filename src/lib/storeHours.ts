import type { SiteSettings } from "@/lib/types";

export type StoreHoursSettings = Pick<
  SiteSettings,
  | "closed_popup_enabled"
  | "closed_days"
  | "open_time"
  | "close_time"
  | "closed_manual"
  | "closed_popup_title"
  | "closed_popup_message"
>;

export const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3, sem horário de verão desde 2019

export type StoreStatus =
  | { closed: false }
  | { closed: true; reason: "manual" | "day" | "before" | "after"; nextOpen: string; dateKey: string };

function toMinutes(time: string | null) {
  const match = time?.match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * A loja está fechada agora (horário de Brasília)? Se sim, diz quando ela
 * volta a entregar — ex.: "no próximo dia útil (segunda-feira), a partir das 10:00".
 */
export function getStoreStatus(settings: StoreHoursSettings, now = new Date()): StoreStatus {
  if (!settings.closed_popup_enabled) return { closed: false };

  const local = new Date(now.getTime() - BRASILIA_OFFSET_MS);
  const today = local.getUTCDay();
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const dateKey = local.toISOString().slice(0, 10);
  const closedDays = new Set(settings.closed_days ?? []);
  const open = toMinutes(settings.open_time);
  const close = toMinutes(settings.close_time);
  const fromTime = open != null ? ` a partir das ${settings.open_time}` : "";

  // Próximo dia (a partir de amanhã) em que a loja abre.
  const nextOpenDay = () => {
    for (let i = 1; i <= 7; i++) {
      const day = (today + i) % 7;
      if (!closedDays.has(day)) {
        return `no próximo dia útil (${WEEKDAYS[day]})${fromTime ? `,${fromTime}` : ""}`;
      }
    }
    return "no próximo dia útil";
  };

  let reason: "manual" | "day" | "before" | "after" | null = null;
  let nextOpen = "";
  if (settings.closed_manual) {
    reason = "manual";
    nextOpen = nextOpenDay();
  } else if (closedDays.has(today)) {
    reason = "day";
    nextOpen = nextOpenDay();
  } else if (open != null && minutes < open) {
    reason = "before";
    nextOpen = `hoje a partir das ${settings.open_time}`;
  } else if (close != null && minutes >= close) {
    reason = "after";
    nextOpen = nextOpenDay();
  }

  return reason ? { closed: true, reason, nextOpen, dateKey } : { closed: false };
}

/** Mensagem do popup com o {proximo_dia} preenchido. */
export function closedMessage(settings: StoreHoursSettings, nextOpen: string) {
  return (settings.closed_popup_message || "").replaceAll("{proximo_dia}", nextOpen);
}
