"use client";

import { useState } from "react";
import { ImageDown } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { HelpTip } from "@/components/ui/HelpTip";
import { Loader } from "@/components/ui/Loader";

type Candidate = { path: string; size: number };
type BatchResult = { before: number; after: number; failed: string[] };

const BATCH = 5;

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Recomprime as fotos já enviadas que estão pesadas (o link delas não muda). */
export function OptimizeImagesCard() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ before: number; after: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const { images } = await adminApi<{ images: Candidate[] }>("listHeavyImages");
      setProgress({ done: 0, total: images.length });
      const total = { before: 0, after: 0, failed: 0 };
      for (let i = 0; i < images.length; i += BATCH) {
        const paths = images.slice(i, i + BATCH).map((img) => img.path);
        const r = await adminApi<BatchResult>("optimizeImages", { paths });
        total.before += r.before;
        total.after += r.after;
        total.failed += r.failed.length;
        setProgress({ done: Math.min(i + BATCH, images.length), total: images.length });
      }
      setResult(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível otimizar as fotos.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <p className="flex items-center gap-2 font-display text-slate-900">
        <ImageDown size={18} className="text-brand" /> Otimizar fotos
        <HelpTip text="As fotos novas já são reduzidas no envio. Este botão reduz as que foram enviadas antes (fotos de celular de vários MB), sem mudar o link nem a aparência. Menos peso = menos tráfego no Supabase e site mais rápido. Pode rodar quantas vezes quiser." />
      </p>
      <p className="text-sm text-slate-600">
        Reduz as fotos de produtos, sabores e banners que estão pesadas. Leva alguns minutos.
      </p>
      <button type="button" className="btn-secondary" onClick={run} disabled={running}>
        {running ? <Loader size={18} /> : "Otimizar fotos agora"}
      </button>
      {running && (
        <p className="text-sm text-slate-600">
          {progress ? `Otimizando ${progress.done} de ${progress.total} fotos...` : "Procurando fotos pesadas..."}
        </p>
      )}
      {result && (
        <p className="text-sm text-green-700">
          {progress?.total === 0
            ? "Nenhuma foto pesada encontrada. Tudo certo!"
            : `Pronto! As fotos foram de ${mb(result.before)} pra ${mb(result.after)}.`}
          {result.failed > 0 && <span className="text-amber-700"> {result.failed} não puderam ser otimizadas.</span>}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
