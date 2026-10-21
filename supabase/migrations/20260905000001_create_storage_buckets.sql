-- Buckets were provisioned outside Git in the original hosted environment.
-- Existing object names and company folder policies stay unchanged.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('item-photos', 'item-photos', false, 5000000),
  ('avatars', 'avatars', false, 3000000),
  ('signatures', 'signatures', false, 2000000),
  ('documents', 'documents', false, 10000000),
  ('payslips', 'payslips', false, 20000000)
ON CONFLICT (id) DO NOTHING;
