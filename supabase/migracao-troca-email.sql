-- ============================================================================
-- Migração: troca de e-mail com código de verificação.
-- Não apaga nenhum dado existente. Rodar uma vez no SQL Editor do Supabase
-- em projetos que já rodaram o schema.sql antes desta data.
-- ============================================================================

alter table site_users add column if not exists pending_email text;
alter table site_users add column if not exists email_change_code text;
alter table site_users add column if not exists email_change_expires_at timestamptz;
