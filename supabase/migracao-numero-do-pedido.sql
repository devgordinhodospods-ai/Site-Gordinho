-- ============================================================================
-- Migração: número do pedido por dia (P1-29-09, P2-29-09, ... e à meia-noite,
-- horário de Brasília, volta pro P1). Rodar uma vez no SQL Editor do Supabase.
-- Não apaga nenhum dado; os pedidos antigos também ganham número.
-- ============================================================================

alter table orders add column if not exists order_day date;       -- dia do pedido (Brasília)
alter table orders add column if not exists day_number int;       -- 1, 2, 3... dentro do dia

-- Numera os pedidos que já existem, na ordem em que foram feitos.
with numbered as (
  select
    id,
    (created_at at time zone 'America/Sao_Paulo')::date as d,
    row_number() over (
      partition by (created_at at time zone 'America/Sao_Paulo')::date
      order by created_at, id
    ) as n
  from orders
  where day_number is null
)
update orders o
set order_day = numbered.d, day_number = numbered.n
from numbered
where o.id = numbered.id;

create unique index if not exists orders_day_number_uidx on orders(order_day, day_number);

-- Todo pedido novo ganha o próximo número do dia. O lock por dia garante
-- que dois pedidos no mesmo instante nunca fiquem com o mesmo número.
create or replace function set_order_day_number() returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.order_day := (coalesce(new.created_at, now()) at time zone 'America/Sao_Paulo')::date;
  perform pg_advisory_xact_lock(hashtext('order_day_number:' || new.order_day::text));
  select coalesce(max(day_number), 0) + 1 into new.day_number from orders where order_day = new.order_day;
  return new;
end;
$fn$;

drop trigger if exists orders_set_day_number on orders;
create trigger orders_set_day_number
  before insert on orders
  for each row execute function set_order_day_number();
