-- ============================================================================
-- Migração: CPF do cliente + endereços salvos (múltiplos, com um padrão).
-- Não apaga nenhum dado existente. Rodar uma vez no SQL Editor do Supabase
-- em projetos que já rodaram o schema.sql antes desta data.
-- ============================================================================

alter table site_users add column if not exists cpf text;

create table if not exists user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references site_users(id) on delete cascade,
  label text,
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  zip text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_addresses_user_idx on user_addresses(user_id);

alter table user_addresses enable row level security;
-- Sem policy de leitura/escrita pública: tudo passa pela service_role via /api.
