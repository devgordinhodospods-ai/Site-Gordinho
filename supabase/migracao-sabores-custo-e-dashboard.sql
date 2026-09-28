-- ============================================================================
-- Migração: sabores/variações por produto, custo de fornecimento (pra
-- calcular lucro/margem) e os campos que o dashboard de monitoramento
-- precisa. Não apaga nenhum dado existente. Rodar uma vez no SQL Editor do
-- Supabase em projetos que já rodaram o schema.sql antes desta data.
-- ============================================================================

alter table products add column if not exists cost_cents int;

create table if not exists product_flavors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  stock int not null default 0 check (stock >= 0),
  image_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_flavors_product_idx on product_flavors(product_id);

alter table product_flavors enable row level security;

drop policy if exists "product_flavors_public_read" on product_flavors;
create policy "product_flavors_public_read" on product_flavors
  for select using (true);

alter table order_items add column if not exists flavor_id uuid references product_flavors(id) on delete set null;
alter table order_items add column if not exists flavor_name text;
alter table order_items add column if not exists unit_cost_cents int;

-- ----------------------------------------------------------------------------
-- create_order_with_items: substitui a função anterior, agora com suporte a
-- sabor por item (desconta o estoque do sabor, não do produto, quando houver)
-- e grava o custo do produto no momento da venda (unit_cost_cents), usado
-- pelo dashboard de monitoramento pra calcular lucro real por pedido.
-- ----------------------------------------------------------------------------
create or replace function create_order_with_items(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_user_id uuid,
  p_shipping_address jsonb,
  p_shipping_zone_id uuid,
  p_shipping_fee_cents int,
  p_service_fee_cents int,
  p_shipping_breakdown jsonb,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $order_fn$
declare
  v_order_id uuid;
  v_subtotal int := 0;
  v_item jsonb;
  v_product record;
  v_flavor record;
  v_qty int;
  v_flavor_id uuid;
  v_flavor_name text;
begin
  for v_item in select * from jsonb_array_elements(p_items) order by (value->>'product_id'), (value->>'flavor_id')
  loop
    v_qty := (v_item->>'quantity')::int;
    v_flavor_id := nullif(v_item->>'flavor_id', '')::uuid;

    select id, price_cents, stock, name, active
      into v_product
      from products
      where id = (v_item->>'product_id')::uuid
      for update;

    if not found or v_product.active = false then
      raise exception 'Produto indisponível: %', (v_item->>'product_id');
    end if;

    if v_flavor_id is not null then
      select id, stock, name into v_flavor
        from product_flavors
        where id = v_flavor_id and product_id = v_product.id
        for update;

      if not found then
        raise exception 'Sabor indisponível para o produto "%"', v_product.name;
      end if;

      if v_flavor.stock < v_qty then
        raise exception 'Estoque insuficiente para "% (%)": restam % unidade(s)', v_product.name, v_flavor.name, v_flavor.stock;
      end if;
    else
      if v_product.stock < v_qty then
        raise exception 'Estoque insuficiente para "%": restam % unidade(s)', v_product.name, v_product.stock;
      end if;
    end if;

    v_subtotal := v_subtotal + (v_product.price_cents * v_qty);
  end loop;

  insert into orders (
    user_id, customer_name, customer_email, customer_phone,
    shipping_address, shipping_zone_id, status,
    subtotal_cents, shipping_fee_cents, service_fee_cents, total_cents,
    shipping_breakdown
  ) values (
    p_user_id, p_customer_name, p_customer_email, p_customer_phone,
    p_shipping_address, p_shipping_zone_id, 'awaiting_payment',
    v_subtotal, p_shipping_fee_cents, p_service_fee_cents,
    -- total = só o que é cobrado no site; o frete é pago ao entregador
    -- (mesma regra de migracao-frete-pago-na-entrega.sql — mantido igual
    -- aqui pra ordem de execução das migrações não importar).
    v_subtotal + p_service_fee_cents,
    p_shipping_breakdown
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::int;
    v_flavor_id := nullif(v_item->>'flavor_id', '')::uuid;

    select id, price_cents, cost_cents, name into v_product
      from products where id = (v_item->>'product_id')::uuid;

    v_flavor_name := null;
    if v_flavor_id is not null then
      select name into v_flavor_name from product_flavors where id = v_flavor_id;
      update product_flavors set stock = stock - v_qty where id = v_flavor_id;
    else
      update products set stock = stock - v_qty, updated_at = now() where id = v_product.id;
    end if;

    insert into order_items (
      order_id, product_id, product_name, flavor_id, flavor_name,
      unit_price_cents, unit_cost_cents, quantity
    )
    values (
      v_order_id, v_product.id, v_product.name, v_flavor_id, v_flavor_name,
      v_product.price_cents, v_product.cost_cents, v_qty
    );
  end loop;

  return v_order_id;
end;
$order_fn$;

revoke all on function create_order_with_items(text,text,text,uuid,jsonb,uuid,int,int,jsonb,jsonb) from public;
grant execute on function create_order_with_items(text,text,text,uuid,jsonb,uuid,int,int,jsonb,jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- cancel_order: agora devolve o estoque pro sabor certo quando o item tinha
-- sabor selecionado.
-- ----------------------------------------------------------------------------
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

  if v_status = 'cancelled' then
    return;
  end if;

  if v_status in ('shipped','delivered') then
    raise exception 'Pedido já enviado/entregue, não pode ser cancelado automaticamente';
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
