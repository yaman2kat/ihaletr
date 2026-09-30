-- Ornek yapi sartnamesi Word sablonlari icin "sartname-sablonlari" public
-- storage bucket'i. Dosyalarin kendisi bu migration ile degil, repo
-- kokundeki sartname-sablonlari-olustur-ve-yukle.mjs script'i ile
-- (service role key kullanarak) yuklenir -- bu migration yalnizca
-- bucket'i ve herkese acik okuma politikasini olusturur.
-- Idempotent, tek "Run" ile guvenle calisir.

INSERT INTO storage.buckets (id, name, public)
VALUES ('sartname-sablonlari', 'sartname-sablonlari', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Herkes sartname sablonunu gorebilir" ON storage.objects;
CREATE POLICY "Herkes sartname sablonunu gorebilir"
  ON storage.objects FOR SELECT USING (bucket_id = 'sartname-sablonlari');

-- Yukleme yalnizca service role (yonetici script'i) ile yapilir, bu
-- yuzden authenticated/anon icin ayrica bir INSERT politikasi eklenmez.

-- DOGRULAMA
SELECT id, public FROM storage.buckets WHERE id = 'sartname-sablonlari';
SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = 'Herkes sartname sablonunu gorebilir';
