-- Teklif vermek icin giris zorunlulugunu DB seviyesinde de kapatir.
-- Idempotent, tek "Run" ile guvenle calisir.
-- (Canli veritabaninda NULL kullanici_id'li satir olmadigi dogrulandi.)

ALTER TABLE public.teklifler ALTER COLUMN kullanici_id SET NOT NULL;

DROP POLICY IF EXISTS "Giris yapan ya da misafir teklif verebilir" ON public.teklifler;
DROP POLICY IF EXISTS "Giris yapan teklif verebilir" ON public.teklifler;
CREATE POLICY "Giris yapan teklif verebilir"
  ON public.teklifler FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = kullanici_id
    AND auth.uid() IS DISTINCT FROM (SELECT olusturan_id FROM public.ihaleler WHERE id = ihale_id)
  );

-- DOGRULAMA
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'teklifler' AND column_name = 'kullanici_id';

SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'teklifler' AND cmd = 'INSERT';
