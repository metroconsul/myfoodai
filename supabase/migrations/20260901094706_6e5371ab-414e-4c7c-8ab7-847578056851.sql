create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  processed_at timestamptz not null default now()
);

grant all on public.stripe_webhook_events to service_role;

alter table public.stripe_webhook_events enable row level security;
-- Sem policies: acesso apenas via service role (webhook no servidor).