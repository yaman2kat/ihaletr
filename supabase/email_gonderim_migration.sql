-- Resend entegrasyonu icin:
-- 1) kullanicilar tablosuna "sure uyarisi" e-posta tercihi ekler (digerleri
--    email_tercihleri_ve_bolge_guncelleme_migration.sql'de zaten eklenmisti).
-- 2) ihaleler tablosuna, 48 saat kala uyari e-postasinin gunde birden fazla
--    kez gonderilmesini (cron her calistiginda) engelleyen bir isaret sutunu
--    ekler.
-- Idempotent, tek "Run" ile guvenle calisir.

ALTER TABLE public.kullanicilar
  ADD COLUMN IF NOT EXISTS email_sure_uyarisi boolean NOT NULL DEFAULT true;

ALTER TABLE public.ihaleler
  ADD COLUMN IF NOT EXISTS sure_uyarisi_gonderildi boolean NOT NULL DEFAULT false;

-- DOGRULAMA
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'kullanicilar' AND column_name = 'email_sure_uyarisi';
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ihaleler' AND column_name = 'sure_uyarisi_gonderildi';
