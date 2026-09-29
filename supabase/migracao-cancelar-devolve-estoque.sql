-- ============================================================================
-- Migração: cancelar pedido devolve o estoque em QUALQUER etapa (inclusive
-- "saiu pra entrega" e "entregue", ex.: reembolso com devolução do produto).
-- Rodar uma vez no SQL Editor do Supabase. Não apaga nenhum dado.
-- ============================================================================

create or replace function cancel_order(p_order_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $cancel_fn$
declare
  v_status text;
  v_item record;
begin
  select status into v_status from orders where id = p_order_id for update;

  if v_status is null then
    raise exception 'Pedido não encontrado';
  end if;

  -- Já cancelado: o estoque já voltou, não devolve de novo.
  if v_status = 'cancelled' then
    return;
  end if;

  for v_item in select product_id, flavor_id, quantity from order_items where order_id = p_order_id
  loop
    if v_item.flavor_id is not null then
      update product_flavors set stock = stock + v_item.quantity where id = v_item.flavor_id;
    elsif v_item.product_id is not null then
      update products set stock = stock + v_item.quantity where id = v_item.product_id;
    end if;
  end loop;

  update orders set status = 'cancelled', updated_at = now() where id = p_order_id;
end;
$cancel_fn$;

revoke all on function cancel_order(uuid) from public;
grant execute on function cancel_order(uuid) to service_role;
