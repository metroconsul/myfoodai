-- Additive: historic records remain valid without photographs.
ALTER TABLE public.time_entries
  ADD COLUMN evidence_path text,
  ADD COLUMN evidence_received_at timestamptz;
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_evidence_pair CHECK (
  (evidence_path IS NULL AND evidence_received_at IS NULL) OR
  (evidence_path IS NOT NULL AND evidence_received_at IS NOT NULL
    AND evidence_path LIKE company_id::text || '/' || employee_id::text || '/%'
    AND evidence_path ~ '^[0-9a-f-]+/[0-9a-f-]+/[0-9]{4}/[0-9]{2}/[0-9a-f-]+[.]jpg$')
);
CREATE UNIQUE INDEX time_entries_evidence_unique ON public.time_entries(evidence_path) WHERE evidence_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('time-clock-evidence', 'time-clock-evidence', false, 2097152, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg'];

-- Restrictive policies also protect this bucket against broad pre-existing policies.
-- Only the server may upload/read/sign/delete evidence after resolving authorization.
CREATE POLICY time_clock_evidence_server_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id <> 'time-clock-evidence')
WITH CHECK (bucket_id <> 'time-clock-evidence');

CREATE FUNCTION public.protect_time_entry_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.evidence_path IS DISTINCT FROM OLD.evidence_path OR
    NEW.evidence_received_at IS DISTINCT FROM OLD.evidence_received_at OR
    (OLD.evidence_path IS NOT NULL AND (
      NEW.company_id IS DISTINCT FROM OLD.company_id OR
      NEW.employee_id IS DISTINCT FROM OLD.employee_id OR
      NEW.unit_id IS DISTINCT FROM OLD.unit_id))
  ) THEN
    RAISE EXCEPTION 'A evidência original do ponto não pode ser alterada.';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.evidence_path IS NOT NULL THEN
    IF current_user NOT IN ('service_role', 'postgres') THEN
      RAISE EXCEPTION 'A evidência deve ser registrada pelo servidor.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = NEW.employee_id
      AND e.company_id = NEW.company_id AND e.unit_id = NEW.unit_id) THEN
      RAISE EXCEPTION 'Colaborador ou unidade inválida para a evidência.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'time-clock-evidence'
      AND o.name = NEW.evidence_path) THEN
      RAISE EXCEPTION 'Foto de confirmação indisponível.';
    END IF;
    NEW.evidence_received_at := clock_timestamp();
    NEW.server_time := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_time_entry_evidence() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_time_entry_evidence BEFORE INSERT OR UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.protect_time_entry_evidence();
