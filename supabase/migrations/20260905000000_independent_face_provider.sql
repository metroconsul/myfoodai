-- Remove the old gateway identifier without changing policy requirements or evidence.
BEGIN;
ALTER TABLE public.acceptance_policies
  DROP CONSTRAINT acceptance_policies_face_provider_check;
UPDATE public.acceptance_policies SET face_provider = 'vision_api'
  WHERE face_provider = 'lovable_ai';
ALTER TABLE public.acceptance_policies ALTER COLUMN face_provider SET DEFAULT 'vision_api';
ALTER TABLE public.acceptance_policies ADD CONSTRAINT acceptance_policies_face_provider_check
  CHECK (face_provider IN ('vision_api', 'selfie_evidence', 'externo'));
COMMIT;
