-- ============================================================
-- IhaleTR - Tasinmaz mulkiyet dogrulama sistemi migration'i.
-- Bu dosyayi Supabase Dashboard > SQL Editor'e yapistirip calistirin.
-- Onceki tum migration'lar (schema.sql, davet_migration.sql,
-- hesap_turu_migration.sql) uygulanmis olmali.
-- Guvenli sekilde tekrar calistirilabilir (idempotent).
-- ============================================================

-- 1) mulkiyet_durumu_tipi enum'u
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mulkiyet_durumu_tipi') THEN
    CREATE TYPE mulkiyet_durumu_tipi AS ENUM ('tek_malik', 'hisseli', 'vekaleten', 'sirket');
  END IF;
END $$;

-- 2) inceleme_durumu enum'u (admin onay/red durumu)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inceleme_durumu') THEN
    CREATE TYPE inceleme_durumu AS ENUM ('beklemede', 'onaylandi', 'reddedildi');
  END IF;
END $$;

-- 3) belge_turu enum'una yeni belge tipleri ekle
ALTER TYPE belge_turu ADD VALUE IF NOT EXISTS 'vekaletname';
ALTER TYPE belge_turu ADD VALUE IF NOT EXISTS 'imza_sirkuleri';

-- 4) ihaleler tablosuna yeni sutunlar
ALTER TABLE public.ihaleler
  ADD COLUMN IF NOT EXISTS mulkiyet_durumu    mulkiyet_durumu_tipi,
  ADD COLUMN IF NOT EXISTS basvuru_sahibi_adi text,
  ADD COLUMN IF NOT EXISTS sirket_unvani      text,
  ADD COLUMN IF NOT EXISTS yetkili_kisi_adi   text,
  ADD COLUMN IF NOT EXISTS inceleme_durumu    inceleme_durumu NOT NULL DEFAULT 'beklemede',
  ADD COLUMN IF NOT EXISTS red_sebebi         text;

CREATE INDEX IF NOT EXISTS idx_ihaleler_inceleme_durumu ON public.ihaleler(inceleme_durumu);

-- Reddedilen bir ihalenin red sebebi bos birakilamaz.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'red_sebebi_zorunlu'
  ) THEN
    ALTER TABLE public.ihaleler
      ADD CONSTRAINT red_sebebi_zorunlu CHECK (
        inceleme_durumu <> 'reddedildi'
        OR (red_sebebi IS NOT NULL AND length(trim(red_sebebi)) > 0)
      );
  END IF;
END $$;

-- 5) RLS: admin, herhangi bir ihalenin inceleme_durumu/red_sebebi
-- alanlarini guncelleyebilsin (mevcut "sahibi guncelleyebilir" politikasina
-- ek permissive politika olarak eklenir, birbirini engellemez).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ihaleler'
      AND policyname = 'Admin ihaleyi inceleyebilir'
  ) THEN
    CREATE POLICY "Admin ihaleyi inceleyebilir"
      ON public.ihaleler FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
      );
  END IF;
END $$;

-- 6) RLS: belgeler tablosunda tapu ile ayni hassasiyette olan yeni
-- belge turlerini (vekaletname, imza_sirkuleri) de admin-only yap.
DROP POLICY IF EXISTS "Tapu haricindeki belgeler herkese acik" ON public.belgeler;
CREATE POLICY "Hassas belgeler sadece admin, digerleri herkese acik"
  ON public.belgeler FOR SELECT USING (
    tur NOT IN ('tapu', 'vekaletname', 'imza_sirkuleri')
    OR EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

-- Not: vekaletname ve imza_sirkuleri dosyalari, tapu ile ayni ozel
-- (private) "ihale-tapu-belgeleri" storage bucket'ina yuklenir; bu
-- bucket'in storage.objects RLS politikalari (schema.sql, bolum 9)
-- zaten bucket_id bazli calistigi icin ek bir storage politikasi
-- gerekmez.
