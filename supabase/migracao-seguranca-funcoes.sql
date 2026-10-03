-- Segurança: as funções que criam e cancelam pedidos só podem ser usadas
-- pelo servidor do site (service_role).
--
-- O Supabase dá permissão de executar funções direto pros papéis "anon" e
-- "authenticated" (a chave pública que vai no navegador). O "revoke ... from
-- public" das migrações antigas não tira essa permissão, então qualquer um
-- com a chave pública conseguiria chamar /rpc/create_order_with_items
-- (criar pedido falso reservando estoque) ou /rpc/cancel_order.
-- Rodar uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.

revoke execute on function create_order_with_items(text,text,text,uuid,jsonb,uuid,int,int,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function create_order_with_items(text,text,text,uuid,jsonb,uuid,int,int,jsonb,jsonb)
  to service_role;

revoke execute on function cancel_order(uuid) from public, anon, authenticated;
grant execute on function cancel_order(uuid) to service_role;

-- Conferência: deve listar só service_role (e o dono, postgres) nas duas.
select routine_name, grantee
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('create_order_with_items', 'cancel_order')
order by routine_name, grantee;
