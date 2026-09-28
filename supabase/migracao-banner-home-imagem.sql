-- ============================================================================
-- Migração: o banner do topo da home vira uma imagem em fundo preto, em vez
-- de título/subtítulo/botão de texto. As chaves antigas (hero_title,
-- hero_subtitle) continuam no banco sem problema, só não são mais lidas.
-- Rodar uma vez no SQL Editor do Supabase.
-- ============================================================================

insert into site_settings (key, value) values
  ('hero_image_url', 'null')
on conflict (key) do nothing;
