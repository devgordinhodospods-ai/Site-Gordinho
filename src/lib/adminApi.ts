"use client";

export async function adminApi<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error ?? "Erro ao comunicar com o painel administrativo.");
  }

  return data as T;
}
