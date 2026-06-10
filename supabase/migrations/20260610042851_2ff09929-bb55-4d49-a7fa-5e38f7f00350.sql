
CREATE POLICY "authed upload own screenshots" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "authed view screenshots" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'screenshots');
CREATE POLICY "owners update screenshots" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
