-- Billing belongs to the tenant. A second administrator must reuse the same
-- Stripe customer and subscription record instead of creating a parallel row.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_company_id_key
  ON public.subscriptions (company_id);
