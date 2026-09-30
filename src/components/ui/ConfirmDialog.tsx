"use client";

import { useCallback, useState } from "react";
import { AlertTriangle } from "lucide-react";

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (value: boolean) => void;
} | null;

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(null);

  const confirm = useCallback(
    (message: string, options?: { title?: string; confirmLabel?: string }) => {
      return new Promise<boolean>((resolve) => {
        setState({
          message,
          title: options?.title ?? "Confirmar ação",
          confirmLabel: options?.confirmLabel ?? "Excluir",
          resolve,
        });
      });
    },
    []
  );

  function handle(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  const dialog = state ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/60 px-4"
      onClick={() => handle(false)}
    >
      <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle size={18} />
          </span>
          <h3 className="font-display text-lg text-slate-900">{state.title}</h3>
        </div>
        <p className="mb-5 text-sm text-slate-600">{state.message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => handle(false)}>
            Cancelar
          </button>
          <button type="button" className="btn-danger" onClick={() => handle(true)}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
