-- ============================================================================
-- Migração: Pix direto no pedido (QR code, copia e cola, link e prazo).
-- Rodar uma vez no SQL Editor do Supabase. Não apaga nenhum dado existente.
-- ============================================================================

alter table orders add column if not exists pix_qr_code text;          -- "Pix copia e cola"
alter table orders add column if not exists payment_url text;          -- link de pagamento do Mercado Pago
alter table orders add column if not exists payment_expires_at timestamptz; -- fim do prazo pra pagar

create index if not exists orders_awaiting_expires_idx
  on orders(payment_expires_at) where status = 'awaiting_payment';
