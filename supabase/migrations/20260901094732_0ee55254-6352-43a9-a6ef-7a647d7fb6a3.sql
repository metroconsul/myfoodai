create policy "Apenas service role acessa eventos do webhook"
  on public.stripe_webhook_events
  for select
  to authenticated
  using (false);