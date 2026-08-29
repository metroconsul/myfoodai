CREATE POLICY "app_files_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('item-photos','avatars','signatures','documents'));
CREATE POLICY "app_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('item-photos','avatars','signatures','documents'));
CREATE POLICY "app_files_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('item-photos','avatars','signatures','documents'))
  WITH CHECK (bucket_id IN ('item-photos','avatars','signatures','documents'));
CREATE POLICY "app_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('item-photos','avatars','signatures','documents'));