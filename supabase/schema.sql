-- ============================================================================
-- Site-Gordinho — schema completo (idempotente)
-- Rodar no SQL editor do Supabase do projeto do cliente.
-- Todas as tabelas têm RLS habilitado. Escrita só via service_role (rotas /api).
-- Leitura pública liberada apenas no necessário para a vitrine funcionar.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- site_settings: configurações editáveis pelo painel (nome da loja, logo, etc)
-- Guardado como key/value para o cliente poder trocar o nicho do negócio
-- inteiro (nome + logo + contatos) sem precisar de migração de banco.
-- ----------------------------------------------------------------------------
create table if not exists site_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

alter table site_settings enable row level security;

drop policy if exists "site_settings_public_read" on site_settings;
create policy "site_settings_public_read" on site_settings
  for select using (true);

-- ----------------------------------------------------------------------------
-- categories
-- ----------------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

drop policy if exists "categories_public_read" on categories;
create policy "categories_public_read" on categories
  for select using (active = true);

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price_cents int not null check (price_cents >= 0),
  compare_at_price_cents int,
  cost_cents int,
  images text[] not null default '{}',
  category_id uuid references categories(id) on delete set null,
  stock int not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_idx on products(category_id);

alter table products enable row level security;

drop policy if exists "products_public_read" on products;
create policy "products_public_read" on products
  for select using (active = true);

-- ----------------------------------------------------------------------------
-- product_flavors: variações opcionais de um produto (sabor, cor, etc), cada
-- uma com seu próprio estoque. Quando um produto tem sabores cadastrados, o
-- cliente escolhe um sabor na página do produto e o estoque descontado na
-- compra é o do sabor, não o do produto em si.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- shipping_zones: regiões de entrega com preço base configurável pelo lojista
-- ----------------------------------------------------------------------------
create table if not exists shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cities text[] not null default '{}',
  neighborhoods text[] not null default '{}',
  base_fee_cents int not null default 0,
  km_from_origin numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table shipping_zones enable row level security;

drop policy if exists "shipping_zones_public_read" on shipping_zones;
create policy "shipping_zones_public_read" on shipping_zones
  for select using (active = true);

-- ----------------------------------------------------------------------------
-- site_users: cadastro de clientes da loja (login por credenciais ou Google)
-- ----------------------------------------------------------------------------
create table if not exists site_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  cpf text,
  password_hash text,
  auth_provider text not null default 'credentials',
  pending_email text,
  email_change_code text,
  email_change_expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table site_users enable row level security;
-- Sem policy de leitura/escrita pública: tudo passa pela service_role via /api.

-- ----------------------------------------------------------------------------
-- pending_signups: cadastros por e-mail aguardando o código de verificação.
-- A conta em site_users só é criada depois que o cliente confirma o código
-- (enviado pelo Supabase Auth), então e-mail falso nunca vira conta.
-- ----------------------------------------------------------------------------
create table if not exists pending_signups (
  email text primary key,
  name text not null,
  phone text,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table pending_signups enable row level security;
-- Sem policy pública: tudo passa pela service_role via /api.

-- ----------------------------------------------------------------------------
-- user_addresses: endereços salvos do cliente (pode ter mais de um)
-- ----------------------------------------------------------------------------
create table if not exists user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references site_users(id) on delete cascade,
  label text,
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  zip text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_addresses_user_idx on user_addresses(user_id);

alter table user_addresses enable row level security;
-- Sem policy de leitura/escrita pública: tudo passa pela service_role via /api.

-- ----------------------------------------------------------------------------
-- orders / order_items
-- ----------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references site_users(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address jsonb not null default '{}',
  shipping_zone_id uuid references shipping_zones(id) on delete set null,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','paid','confirmed','preparing','shipped','delivered','cancelled')),
  subtotal_cents int not null default 0,
  shipping_fee_cents int not null default 0,
  service_fee_cents int not null default 0,
  total_cents int not null default 0,
  payment_provider text not null default 'mercadopago',
  payment_id text,
  payment_status text,
  shipping_breakdown jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_idx on orders(user_id);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_payment_id_idx on orders(payment_id);
create index if not exists orders_customer_email_idx on orders(customer_email);
create index if not exists orders_created_at_idx on orders(created_at desc);

alter table orders enable row level security;
-- Sem policy pública: leitura/escrita só via service_role (rota valida dono do pedido ou admin).

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  flavor_id uuid references product_flavors(id) on delete set null,
  flavor_name text,
  unit_price_cents int not null,
  unit_cost_cents int,
  quantity int not null check (quantity > 0)
);

create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists order_items_product_idx on order_items(product_id);

alter table order_items enable row level security;

-- ----------------------------------------------------------------------------
-- create_order_with_items: cria o pedido inteiro em uma transação atômica.
-- Trava (FOR UPDATE) cada produto envolvido, valida estoque e só então grava
-- pedido + itens + desconta estoque. Evita duas pessoas comprarem a última
-- unidade ao mesmo tempo. Só pode ser chamada pela service_role (rota /api).
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

-- ----------------------------------------------------------------------------
-- cancel_order: cancela um pedido e devolve os itens ao estoque.
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

-- ----------------------------------------------------------------------------
-- Storage buckets
-- Rodar via dashboard (Storage) ou supabase-js admin:
--   product-images (público)  -> fotos de produto e logo da loja
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

-- ----------------------------------------------------------------------------
-- Seed inicial de configurações (nome genérico — cliente troca no painel)
-- ----------------------------------------------------------------------------
insert into site_settings (key, value) values
  ('store_name', '"Minha Loja"'),
  ('store_logo_url', 'null'),
  ('store_favicon_url', 'null'),
  ('footer_image_url', 'null'),
  ('contact_whatsapp', 'null'),
  ('contact_email', 'null'),
  ('contact_instagram', 'null'),
  ('origin_cep', 'null'),
  ('shipping_base_fee_cents', '500'),
  ('shipping_per_km_cents', '150'),
  ('shipping_max_km', '15'),
  ('origin_address', 'null'),
  ('origin_lat', 'null'),
  ('origin_lng', 'null'),
  ('service_fee_percent', '5'),
  ('service_fee_fixed', '0'),
  ('announcement_text', '"Compra 100% segura • Pagamento via Pix"'),
  ('hero_image_url', 'null')
on conflict (key) do nothing;
