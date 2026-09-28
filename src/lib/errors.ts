/**
 * Erros do supabase-js (Postgrest, Storage, Auth) são objetos comuns com uma
 * propriedade `message`, não instâncias de `Error` — checar só
 * `instanceof Error` engole a mensagem real e mostra um fallback genérico.
 */
export function getErrorMessage(err: unknown, fallback = "Erro interno."): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return fallback;
}
