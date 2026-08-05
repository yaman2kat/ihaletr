-- KRITIK: canli veritabaninda "ihale-belgeleri" ve "ihale-tapu-belgeleri"
-- storage bucket'larinin HICBIRI mevcut degildi (dogrulandi: listBuckets()
-- bos donuyordu). Bu, ihale-olustur formundaki TUM dosya yukleme
-- ozelliginin (sartname, sozlesme, proje, tapu, vekaletname, imza
-- sirkuleri) su ana kadar hicbir zaman gercekten calismadigi anlamina
-- geliyor. Idempotent, tek "Run" ile guvenle calisir.

-- 1) "ihale-belgeleri" -herkese acik okuma (public URL), sartname/
-- sozlesme/proje dosyalari icin. Bucket'in kendisi public=true olsa da
-- INSERT/SELECT icin ayrica storage.objects RLS politikasi gerekir.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ihale-belgeleri', 'ihale-belgeleri', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Herkes ihale belgesi yukleyebilir" ON storage.objects;
CREATE POLICY "Herkes ihale belgesi yukleyebilir"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ihale-belgeleri');

DROP POLICY IF EXISTS "Herkes ihale belgesini gorebilir" ON storage.objects;
CREATE POLICY "Herkes ihale belgesini gorebilir"
  ON storage.objects FOR SELECT USING (bucket_id = 'ihale-belgeleri');

-- 2) "ihale-tapu-belgeleri" -ozel (private), yalnizca admin okuyabilir.
-- schema.sql'de tanimliydi ama canli veritabaninda hic calistirilmamisti.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ihale-tapu-belgeleri', 'ihale-tapu-belgeleri', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Sadece admin tapu belgesini gorebilir" ON storage.objects;
CREATE POLICY "Sadece admin tapu belgesini gorebilir"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'ihale-tapu-belgeleri'
    AND EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

DROP POLICY IF EXISTS "Herkes tapu belgesi yukleyebilir" ON storage.objects;
CREATE POLICY "Herkes tapu belgesi yukleyebilir"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ihale-tapu-belgeleri');

-- DOGRULAMA
SELECT id, public FROM storage.buckets WHERE id IN ('ihale-belgeleri', 'ihale-tapu-belgeleri');
SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname IN ('Herkes ihale belgesi yukleyebilir', 'Herkes ihale belgesini gorebilir',
                      'Sadece admin tapu belgesini gorebilir', 'Herkes tapu belgesi yukleyebilir');
