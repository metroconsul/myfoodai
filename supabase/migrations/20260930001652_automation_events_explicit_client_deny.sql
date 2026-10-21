-- The automation event ledger is server-only. This explicit deny policy documents
-- that browser roles must never access it, while service_role continues to bypass RLS.
create policy automation_events_deny_client_access
  on public.automation_events
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
