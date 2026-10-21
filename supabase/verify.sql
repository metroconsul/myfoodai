-- Read-only post-migration checks. Run in the destination Supabase SQL editor.
-- Every application table should have RLS enabled.
SELECT schemaname, tablename, rowsecurity
FROM pg_tables WHERE schemaname = 'public'
ORDER BY tablename;

SELECT id, name, public
FROM storage.buckets
WHERE id IN ('item-photos', 'avatars', 'signatures', 'documents', 'payslips')
ORDER BY id;

-- Expected: only vision_api / externo / selfie_evidence.
SELECT face_provider, count(*) FROM public.acceptance_policies GROUP BY face_provider;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.acceptance_policies'::regclass;

-- Inspect grants/policies and compare with the versioned schema before cutover.
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;
