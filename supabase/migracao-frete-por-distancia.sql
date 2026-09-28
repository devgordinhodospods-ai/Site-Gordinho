-- ============================================================================
-- Migração: frete estimado pela distância do CEP do cliente até a loja.
-- O operador só informa o CEP da loja, a taxa base, o valor por km e a
-- distância máxima de entrega (tudo em Painel → Frete). Rodar uma vez no SQL
-- Editor do Supabase. Não apaga nenhum dado existente.
-- ============================================================================

insert into site_settings (key, value) values
  ('origin_cep', 'null'),
  ('origin_address', 'null'),
  ('origin_lat', 'null'),
  ('origin_lng', 'null'),
  ('shipping_base_fee_cents', '500'),
  ('shipping_per_km_cents', '150'),
  ('shipping_max_km', '15')
on conflict (key) do nothing;
