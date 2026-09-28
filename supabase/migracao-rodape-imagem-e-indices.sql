-- ============================================================================
-- Migração: imagem própria do rodapé + índices de performance.
-- Rodar uma vez no SQL Editor do Supabase. Não apaga nenhum dado existente.
-- ============================================================================

-- Nova configuração: imagem exibida no rodapé (se vazia, o rodapé usa a
-- mesma logo da navbar).
insert into site_settings (key, value) values
  ('footer_image_url', 'null')
on conflict (key) do nothing;

-- Índices que faltavam para as consultas mais comuns do site: histórico de
-- pedidos do cliente (por e-mail), listagem/estatísticas por data, e
-- agregações do dashboard de monitoramento por produto.
create index if not exists orders_customer_email_idx on orders(customer_email);
create index if not exists orders_created_at_idx on orders(created_at desc);
create index if not exists order_items_product_idx on order_items(product_id);
