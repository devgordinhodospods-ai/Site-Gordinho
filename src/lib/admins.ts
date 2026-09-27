/**
 * Allowlist simples de administradores da loja, por e-mail.
 * Configurar em ADMIN_EMAILS (separado por vírgula) no ambiente.
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
