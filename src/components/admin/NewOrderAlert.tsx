"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, X } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { centsToBRL } from "@/lib/money";
import { orderCode } from "@/lib/orderCode";

type PaidOrder = {
  id: string;
  day_number: number | null;
  order_day: string | null;
  created_at: string;
  customer_name: string;
  total_cents: number;
};

const POLL_MS = 12_000;
const SOUND_KEY = "admin-som-pedido";
/** Avisado pela tela de Pedidos pra recarregar a lista sozinha. */
export const NEW_ORDER_EVENT = "admin:new-order";

/** Campainha "ding-dong" tocada 3 vezes, gerada no navegador (sem arquivo de áudio). */
function playChime(ctx: AudioContext) {
  const start = ctx.currentTime + 0.05;
  for (let rep = 0; rep < 3; rep++) {
    [1318.5, 1046.5].forEach((freq, i) => {
      const t = start + rep * 0.9 + i * 0.28;
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      overtone.type = "triangle";
      osc.frequency.value = freq;
      overtone.frequency.value = freq * 2;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      const overtoneGain = ctx.createGain();
      overtoneGain.gain.value = 0.15;
      osc.connect(gain);
      overtone.connect(overtoneGain).connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      overtone.start(t);
      osc.stop(t + 0.85);
      overtone.stop(t + 0.85);
    });
  }
}

/**
 * Fica no layout do painel: confere a cada 12 s se entrou pedido pago novo e,
 * se entrou, toca uma campainha, mostra um aviso na tela e pisca o título da aba.
 */
export function NewOrderAlert() {
  const [soundOn, setSoundOn] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [fresh, setFresh] = useState<PaidOrder[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const seenRef = useRef<Set<string> | null>(null);
  const soundOnRef = useRef(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SOUND_KEY);
      if (saved === "off") {
        setSoundOn(false);
        soundOnRef.current = false;
      }
    } catch {
      // sem armazenamento: fica ligado
    }
  }, []);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioRef.current = new Ctor();
    }
    return audioRef.current;
  }, []);

  const ring = useCallback(async () => {
    if (!soundOnRef.current) return;
    const ctx = getAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    if (ctx.state !== "running") {
      // O navegador só deixa tocar som depois de um clique na página.
      setAudioBlocked(true);
      return;
    }
    setAudioBlocked(false);
    playChime(ctx);
  }, [getAudio]);

  // Qualquer clique/tecla no painel libera o áudio pro próximo pedido.
  useEffect(() => {
    const unlock = () => {
      const ctx = getAudio();
      if (ctx?.state === "suspended") ctx.resume().catch(() => {});
      if (ctx?.state === "running") setAudioBlocked(false);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [getAudio]);

  useEffect(() => {
    let stopped = false;
    async function check() {
      try {
        const { paid } = await adminApi<{ paid: PaidOrder[] }>("orderPulse");
        if (stopped) return;
        const ids = new Set(paid.map((o) => o.id));
        if (seenRef.current) {
          const novos = paid.filter((o) => !seenRef.current!.has(o.id));
          if (novos.length > 0) {
            setFresh((list) => [...novos, ...list.filter((o) => !novos.some((n) => n.id === o.id))].slice(0, 5));
            ring();
            window.dispatchEvent(new CustomEvent(NEW_ORDER_EVENT));
          }
          // Mantém os já vistos (um pedido que saiu de "pago" e voltou não toca de novo).
          ids.forEach((id) => seenRef.current!.add(id));
        } else {
          // Primeira consulta: só marca o que já existe, sem tocar.
          seenRef.current = ids;
        }
      } catch {
        // sem internet / sessão expirada: tenta de novo no próximo ciclo
      }
    }
    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [ring]);

  // Título da aba piscando enquanto tiver aviso aberto.
  useEffect(() => {
    if (fresh.length === 0) return;
    const original = document.title;
    let on = false;
    const id = setInterval(() => {
      on = !on;
      document.title = on ? `🔔 (${fresh.length}) Pedido novo!` : original;
    }, 1000);
    return () => {
      clearInterval(id);
      document.title = original;
    };
  }, [fresh.length]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    soundOnRef.current = next;
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // ignora
    }
    if (next) ring();
  }

  return (
    <>
      <div className="card mt-3 flex items-center gap-2 p-2 text-sm">
        <button
          type="button"
          onClick={toggleSound}
          className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
            soundOn ? "text-slate-700 hover:bg-blue-50" : "text-slate-400 hover:bg-blue-50"
          }`}
          aria-pressed={soundOn}
          title="Toca uma campainha quando entra pedido pago"
        >
          {soundOn ? <Bell size={16} className="shrink-0 text-brand" /> : <BellOff size={16} className="shrink-0" />}
          <span className="whitespace-nowrap leading-tight">
            Som de pedido
            <span className={`block text-xs ${soundOn ? "text-green-600" : "text-slate-400"}`}>
              {soundOn ? "ligado" : "desligado"}
            </span>
          </span>
        </button>
        {soundOn && (
          <button
            type="button"
            onClick={() => ring()}
            className="shrink-0 rounded-lg px-2.5 py-2 text-xs text-brand hover:bg-blue-50"
          >
            Testar
          </button>
        )}
      </div>

      {fresh.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[70] w-[min(92vw,360px)] animate-[popIn_.25s_ease-out]" role="alert">
          <div className="theme-static overflow-hidden rounded-2xl text-white shadow-2xl">
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 45%, #0284c7 100%)" }}
            >
              <BellRing size={22} className="shrink-0 animate-bounce" />
              <p className="font-display flex-1 text-lg">
                {fresh.length === 1 ? "Pedido novo pago!" : `${fresh.length} pedidos novos pagos!`}
              </p>
              <button
                type="button"
                onClick={() => setFresh([])}
                className="rounded-lg p-1 hover:bg-white/20"
                aria-label="Fechar aviso"
              >
                <X size={18} />
              </button>
            </div>
            <div className="bg-brand-ink px-4 py-3">
              <ul className="space-y-1.5 text-sm">
                {fresh.map((o) => (
                  <li key={o.id} className="flex justify-between gap-3">
                    <span className="truncate text-slate-200">
                      #{orderCode(o)} · {o.customer_name}
                    </span>
                    <span className="shrink-0 text-accent">{centsToBRL(o.total_cents)}</span>
                  </li>
                ))}
              </ul>
              {audioBlocked && soundOn && (
                <button
                  type="button"
                  onClick={() => ring()}
                  className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/15"
                >
                  🔇 O navegador bloqueou o som. Toque aqui pra ativar.
                </button>
              )}
              <Link
                href="/admin/pedidos"
                onClick={() => setFresh([])}
                className="btn-primary mt-3 w-full py-2 text-sm"
              >
                Ver pedidos
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
