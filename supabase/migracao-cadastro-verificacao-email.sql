-- ============================================================================
-- Migração: verificação de e-mail no cadastro (código enviado pelo Supabase).
-- Rodar uma vez no SQL Editor do Supabase. Não apaga nenhum dado existente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- pending_signups: cadastros por e-mail aguardando o código de verificação.
-- A conta em site_users só é criada depois que o cliente confirma o código
-- (enviado pelo Supabase Auth), então e-mail falso nunca vira conta.
-- ----------------------------------------------------------------------------
create table if not exists pending_signups (
  email text primary key,
  name text not null,
  phone text,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table pending_signups enable row level security;
-- Sem policy pública: tudo passa pela service_role via /api.
