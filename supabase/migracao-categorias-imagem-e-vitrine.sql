-- ============================================================================
-- Migração: imagem de capa por categoria + configurações da vitrine da home
-- Não apaga nenhum dado existente. Rodar uma vez no SQL Editor do Supabase
-- em projetos que já rodaram o schema.sql antes desta data.
-- ============================================================================

alter table categories add column if not exists image_url text;

insert into site_settings (key, value) values
  ('announcement_text', '"Compra 100% segura • Pagamento via Mercado Pago"'),
  ('hero_title', 'null'),
  ('hero_subtitle', 'null')
on conflict (key) do nothing;
