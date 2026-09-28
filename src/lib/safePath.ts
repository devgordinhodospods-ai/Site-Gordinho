/** Aceita só caminhos internos da loja (evita redirecionar pra outro site). */
export function safePath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
