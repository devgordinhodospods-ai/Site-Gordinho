-- ============================================================================
-- Migração: frete passa a ser pago direto ao entregador na entrega (em vez
-- de ser cobrado junto no Mercado Pago). A partir de agora:
--   - total_cents do pedido = subtotal + taxa de serviço (o que é cobrado no site)
--   - shipping_fee_cents continua guardado no pedido, mas como ESTIMATIVA a
--     ser paga em dinheiro/pix direto pro entregador no momento da entrega.
-- Não apaga nenhum dado existente. Rodar uma vez no SQL Editor do Supabase.
-- Pedidos já existentes não são recalculados (o total_cents deles fica como
-- já estava).
-- ============================================================================

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
  -- 1ª passada: trava produtos e sabores envolvidos (em ordem estável, pra
  -- evitar deadlock), valida estoque e calcula o subtotal. Nada é gravado
  -- ainda nesta passada.
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

  -- total_cents é só o que é cobrado no site (produto + taxa de serviço).
  -- O frete (shipping_fee_cents) é uma estimativa, paga em dinheiro/pix
  -- direto pro entregador no momento da entrega — não entra na cobrança
  -- do Mercado Pago.
  insert into orders (
    user_id, customer_name, customer_email, customer_phone,
    shipping_address, shipping_zone_id, status,
    subtotal_cents, shipping_fee_cents, service_fee_cents, total_cents,
    shipping_breakdown
  ) values (
    p_user_id, p_customer_name, p_customer_email, p_customer_phone,
    p_shipping_address, p_shipping_zone_id, 'awaiting_payment',
    v_subtotal, p_shipping_fee_cents, p_service_fee_cents,
    v_subtotal + p_service_fee_cents,
    p_shipping_breakdown
  ) returning id into v_order_id;

  -- 2ª passada: já validado, agora grava os itens e desconta o estoque
  -- (do sabor, se houver, senão do produto).
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
