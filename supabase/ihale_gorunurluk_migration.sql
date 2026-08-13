-- Ihale gorunurlugu: "beklemede" (henuz incelenmemis) ya da "reddedildi"
-- durumundaki ihaleler artik genel/herkese acik sorgularda (ornegin
-- /ihaleler listesi) GORUNMEZ. Yalnizca inceleme_durumu = 'onaylandi'
-- olan ihaleler herkese acik; sahibi kendi ihalesini (hangi durumda
-- olursa olsun) ve admin TUM ihaleleri gorebilmeye devam eder.
-- Idempotent, tek "Run" ile guvenle calisir.

DROP POLICY IF EXISTS "Herkes ihaleleri gorebilir" ON public.ihaleler;
CREATE POLICY "Onayli herkese, sahibine ve admine acik"
  ON public.ihaleler FOR SELECT USING (
    inceleme_durumu = 'onaylandi'
    OR olusturan_id = auth.uid()
    OR public.is_admin()
  );

-- DOGRULAMA
SELECT policyname, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'ihaleler' AND cmd = 'SELECT';
