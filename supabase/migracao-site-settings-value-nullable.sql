-- ============================================================================
-- Migração: permite valor nulo em site_settings.value.
-- Sem isso, salvar Configurações da loja dá erro ("null value in column
-- value... violates not-null constraint") sempre que algum campo opcional
-- (hero_title, hero_subtitle, endereço de origem/lat/lng, favicon etc.)
-- estiver vazio — o Supabase trata um JS `null` como SQL NULL na coluna,
-- não como o literal JSON null, e a constraint barrava isso.
-- Não apaga nenhum dado existente. Rodar uma vez no SQL Editor do Supabase.
-- ============================================================================

alter table site_settings alter column value drop not null;
