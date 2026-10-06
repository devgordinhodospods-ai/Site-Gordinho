/**
 * Allowlist simples de administradores da loja, por e-mail.
 * Configurar em ADMIN_EMAILS no ambiente: separados por vírgula (aceita
 * também ponto e vírgula, espaço ou um por linha).
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
