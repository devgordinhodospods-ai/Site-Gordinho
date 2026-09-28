-- ============================================================================
-- Dados de exemplo (categorias + produtos) só para visualizar a vitrine.
-- Pode rodar quantas vezes quiser: usa "on conflict do nothing" pelo slug.
-- Requer que a migração migracao-categorias-imagem-e-vitrine.sql já tenha
-- rodado (coluna categories.image_url).
-- As imagens são geradas na hora pelo placehold.co, só para representar o
-- produto — troque pelas fotos reais no painel admin quando quiser.
-- ============================================================================

insert into categories (name, slug, image_url, position, active) values
  ('Tabacos e Fumos', 'tabacos-e-fumos', 'https://placehold.co/900x700/1d4ed8/ffffff/png?text=Tabacos+e+Fumos', 0, true),
  ('Sedas e Papéis', 'sedas-e-papeis', 'https://placehold.co/900x700/0f2f8f/ffffff/png?text=Sedas+e+Papeis', 1, true),
  ('Piteiras e Filtros', 'piteiras-e-filtros', 'https://placehold.co/900x700/3b82f6/ffffff/png?text=Piteiras+e+Filtros', 2, true),
  ('Acessórios', 'acessorios', 'https://placehold.co/900x700/1d4ed8/ffffff/png?text=Acessorios', 3, true)
on conflict (slug) do nothing;

insert into products (name, slug, description, price_cents, compare_at_price_cents, images, category_id, stock, active)
values
  (
    'Tabaco Blend Tradicional 50g', 'tabaco-blend-tradicional-50g',
    'Blend tradicional de corte fino, 50g, ideal para o dia a dia.',
    1590, null,
    array['https://placehold.co/800x800/1d4ed8/ffffff/png?text=Tabaco+Blend+50g'],
    (select id from categories where slug = 'tabacos-e-fumos'), 25, true
  ),
  (
    'Tabaco Aromatizado Menta 25g', 'tabaco-aromatizado-menta-25g',
    'Tabaco aromatizado sabor menta, embalagem de 25g.',
    1290, 1590,
    array['https://placehold.co/800x800/1d4ed8/ffffff/png?text=Tabaco+Menta+25g'],
    (select id from categories where slug = 'tabacos-e-fumos'), 18, true
  ),
  (
    'Tabaco Virginia Desfiado 25g', 'tabaco-virginia-desfiado-25g',
    'Tabaco Virginia desfiado, corte médio, 25g.',
    1690, null,
    array['https://placehold.co/800x800/1d4ed8/ffffff/png?text=Tabaco+Virginia+25g'],
    (select id from categories where slug = 'tabacos-e-fumos'), 12, true
  ),
  (
    'Seda King Size Ultra Fina', 'seda-king-size-ultra-fina',
    'Pacote com 32 folhas king size ultra finas.',
    890, null,
    array['https://placehold.co/800x800/0f2f8f/ffffff/png?text=Seda+King+Size'],
    (select id from categories where slug = 'sedas-e-papeis'), 60, true
  ),
  (
    'Seda Extra Fina com 50 Folhas', 'seda-extra-fina-50-folhas',
    'Livrinho com 50 folhas extra finas.',
    650, 790,
    array['https://placehold.co/800x800/0f2f8f/ffffff/png?text=Seda+Extra+Fina'],
    (select id from categories where slug = 'sedas-e-papeis'), 40, true
  ),
  (
    'Papel de Enrolar Orgânico', 'papel-de-enrolar-organico',
    'Papel 100% orgânico, sem branqueamento químico.',
    990, null,
    array['https://placehold.co/800x800/0f2f8f/ffffff/png?text=Papel+Organico'],
    (select id from categories where slug = 'sedas-e-papeis'), 30, true
  ),
  (
    'Piteira de Vidro Curva', 'piteira-de-vidro-curva',
    'Piteira de vidro reutilizável, formato curvo.',
    2490, null,
    array['https://placehold.co/800x800/3b82f6/ffffff/png?text=Piteira+de+Vidro'],
    (select id from categories where slug = 'piteiras-e-filtros'), 15, true
  ),
  (
    'Piteira Descartável Kit 50un', 'piteira-descartavel-kit-50un',
    'Kit com 50 piteiras descartáveis de papel.',
    1190, 1490,
    array['https://placehold.co/800x800/3b82f6/ffffff/png?text=Piteira+Kit+50un'],
    (select id from categories where slug = 'piteiras-e-filtros'), 22, true
  ),
  (
    'Filtro de Papelão Slim', 'filtro-de-papelao-slim',
    'Bloco de filtros de papelão, formato slim.',
    590, null,
    array['https://placehold.co/800x800/3b82f6/ffffff/png?text=Filtro+Slim'],
    (select id from categories where slug = 'piteiras-e-filtros'), 50, true
  ),
  (
    'Isqueiro à Prova de Vento', 'isqueiro-a-prova-de-vento',
    'Isqueiro recarregável, chama dupla, à prova de vento.',
    3490, null,
    array['https://placehold.co/800x800/1d4ed8/ffffff/png?text=Isqueiro'],
    (select id from categories where slug = 'acessorios'), 20, true
  ),
  (
    'Bandeja de Rolar Metálica', 'bandeja-de-rolar-metalica',
    'Bandeja metálica antiaderente para organizar sua sessão.',
    4290, 5290,
    array['https://placehold.co/800x800/1d4ed8/ffffff/png?text=Bandeja+Metalica'],
    (select id from categories where slug = 'acessorios'), 10, true
  ),
  (
    'Dichavador de Alumínio', 'dichavador-de-aluminio',
    'Dichavador em alumínio de 4 partes, com coletor de pólen.',
    3990, null,
    array['https://placehold.co/800x800/1d4ed8/ffffff/png?text=Dichavador'],
    (select id from categories where slug = 'acessorios'), 14, true
  )
on conflict (slug) do nothing;

insert into shipping_zones (name, cities, neighborhoods, base_fee_cents, km_from_origin, active)
select 'Centro (exemplo)', array['São Paulo'], array['Centro'], 800, 5, true
where not exists (select 1 from shipping_zones);
