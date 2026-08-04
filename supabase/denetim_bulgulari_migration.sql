-- Kapsamli denetimde bulunan DB bulgularini toplayan migration.
-- Idempotent, tek "Run" ile guvenle calisir.

-- 1) muteahhit_profiller.yetki_belgesi_grubu eksikti (profil duzenleme
-- formu bu alani gonderiyordu ama sutun canlida yoktu; hata bos bir
-- catch{} icinde yutuluyordu, kullanici hicbir uyari gormeden secimi
-- kayboluyordu).
ALTER TABLE public.muteahhit_profiller ADD COLUMN IF NOT EXISTS yetki_belgesi_grubu text;

ALTER TABLE public.muteahhit_profiller DROP CONSTRAINT IF EXISTS muteahhit_profiller_yetki_belgesi_grubu_check;
ALTER TABLE public.muteahhit_profiller ADD CONSTRAINT muteahhit_profiller_yetki_belgesi_grubu_check
  CHECK (yetki_belgesi_grubu IS NULL OR yetki_belgesi_grubu IN ('A','B','C','D','E','F','G','H','Geçici/Y Belgesi'));

-- 2) teklifler INSERT politikasinda NULL karsilastirma hatasi: bir
-- ihalenin olusturan_id'si NULL ise (sahibi silinmis ya da misafir
-- olarak olusturulmus ihale), "auth.uid() != olusturan_id" SQL'de NULL
-- doner ve WITH CHECK bunu red sayar - o ihaleye kimse asla teklif
-- veremez. "IS DISTINCT FROM" NULL'u guvenli karsilastirir.
DROP POLICY IF EXISTS "Giris yapan ya da misafir teklif verebilir" ON public.teklifler;
CREATE POLICY "Giris yapan ya da misafir teklif verebilir"
  ON public.teklifler FOR INSERT WITH CHECK (
    (
      auth.uid() IS NOT NULL
      AND auth.uid() = kullanici_id
      AND auth.uid() IS DISTINCT FROM (SELECT olusturan_id FROM public.ihaleler WHERE id = ihale_id)
    )
    OR (
      auth.uid() IS NULL
      AND kullanici_id IS NULL
    )
  );

-- DOGRULAMA
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'muteahhit_profiller' AND column_name = 'yetki_belgesi_grubu';

SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'teklifler' AND policyname = 'Giris yapan ya da misafir teklif verebilir';
