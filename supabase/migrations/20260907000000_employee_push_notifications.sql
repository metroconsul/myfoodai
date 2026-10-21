-- Dispositivos do Portal do Colaborador e auditoria de notificações push.
-- Tokens FCM ficam inacessíveis aos papéis do navegador; somente o backend os utiliza.

CREATE TABLE public.employee_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  firebase_installation_id text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  device_name text,
  browser text,
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_notification_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_devices_platform_check
    CHECK (platform IN ('web', 'android', 'ios', 'desktop'))
);

CREATE UNIQUE INDEX employee_devices_active_installation_unique
  ON public.employee_devices(firebase_installation_id)
  WHERE is_active;

CREATE INDEX employee_devices_employee_active_idx
  ON public.employee_devices(employee_id, is_active);

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.employee_devices(id) ON DELETE RESTRICT,
  notification_type text NOT NULL,
  event_reference uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  firebase_message_id text,
  sent_at timestamptz,
  failed_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_status_check
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  CONSTRAINT notification_delivery_once_per_device
    UNIQUE (device_id, notification_type, event_reference)
);

CREATE INDEX notification_deliveries_employee_created_idx
  ON public.notification_deliveries(employee_id, created_at DESC);

CREATE TRIGGER set_updated_at_employee_devices
  BEFORE UPDATE ON public.employee_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_devices ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.employee_devices FROM anon, authenticated;

REVOKE ALL ON public.notification_deliveries FROM anon, authenticated;

GRANT ALL ON public.employee_devices TO service_role;

GRANT ALL ON public.notification_deliveries TO service_role;

CREATE POLICY employee_devices_service_only ON public.employee_devices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY notification_deliveries_service_only ON public.notification_deliveries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Garante isolamento multiempresa mesmo se um cliente privilegiado enviar IDs incompatíveis.
CREATE OR REPLACE FUNCTION public.validate_employee_device_company()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = NEW.employee_id AND e.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'employee does not belong to company';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_employee_devices_company
  BEFORE INSERT OR UPDATE ON public.employee_devices
  FOR EACH ROW EXECUTE FUNCTION public.validate_employee_device_company();

CREATE OR REPLACE FUNCTION public.validate_notification_delivery_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_devices d
    WHERE d.id = NEW.device_id
      AND d.employee_id = NEW.employee_id
      AND d.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'device does not belong to employee and company';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_notification_deliveries_company
  BEFORE INSERT OR UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.validate_notification_delivery_scope();

-- Troca de conta no mesmo aparelho desativa o vínculo anterior, preservando a auditoria.
CREATE OR REPLACE FUNCTION public.register_employee_push_device(
  p_company_id uuid,
  p_employee_id uuid,
  p_installation_id text,
  p_platform text,
  p_device_name text,
  p_browser text,
  p_user_agent text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.employee_devices
     SET is_active = false
   WHERE is_active
     AND firebase_installation_id = p_installation_id;

  INSERT INTO public.employee_devices (
    company_id, employee_id, firebase_installation_id,
    platform, device_name, browser, user_agent, is_active, last_seen_at
  ) VALUES (
    p_company_id, p_employee_id, p_installation_id,
    p_platform, p_device_name, p_browser, p_user_agent, true, now()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_employee_push_device(uuid, uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.register_employee_push_device(uuid, uuid, text, text, text, text, text)
  TO service_role;
