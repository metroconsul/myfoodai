-- Mercado Pago: sincronização automática a cada 2 minutos.
-- O webhook do app só recebe pagamentos criados pela própria integração; vendas da
-- maquininha, Pix e link feitas na conta do estabelecimento não geram aviso. Por isso
-- o banco (pg_cron + pg_net) chama o servidor periodicamente, que busca as vendas
-- novas ou alteradas nas últimas 24h de todas as conexões ativas.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Segredo gerado no próprio banco: ninguém precisa copiar ou digitar.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'mp_sync_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'mp_sync_cron_secret',
      'Autoriza o agendador do banco a chamar /api/automation/mercado-pago-sync');
  end if;
end $$;

-- Só o servidor (service_role) lê o segredo para conferir a chamada.
create or replace function public.mp_sync_cron_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'mp_sync_cron_secret' limit 1;
$$;

revoke all on function public.mp_sync_cron_secret() from public, anon, authenticated;
grant execute on function public.mp_sync_cron_secret() to service_role;

select cron.schedule(
  'mercado-pago-sync',
  '*/2 * * * *',
  $job$
  select net.http_post(
    url := 'https://myfoodsai.com/api/automation/mercado-pago-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mp_sync_cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  where exists (select 1 from public.sales_connections where provider = 'mercado_pago' and active);
  $job$
);
