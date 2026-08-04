-- ============================================================
-- IhaleTR - Tasinmaz mulkiyet dogrulama sistemi migration'i
-- TEK DOSYA - tamamen idempotent, guvenle tekrar tekrar calistirilabilir.
-- Bu dosyayi Supabase Dashboard > SQL Editor'e yapistirip calistirin (Run).
-- ============================================================
-- Her adim zaten uygulanmis olsa bile hata VERMEDEN atlanacak sekilde
-- yazildi:
--   - Enum TIPLERI  : CREATE TYPE ... EXCEPTION WHEN duplicate_object
--   - Enum DEGERLERI: ALTER TYPE ... ADD VALUE IF NOT EXISTS (native)
--   - Tablo sutunlari: ADD COLUMN IF NOT EXISTS (native)
--   - Kisit/Policy  : onceden pg_constraint/pg_policies'te var mi
--     kontrol edilip yoksa eklenir.
-- ============================================================

-- 1) mulkiyet_durumu_tipi ve inceleme_durumu enum TIPLERI
DO $$
BEGIN
  CREATE TYPE mulkiyet_durumu_tipi AS ENUM ('tek_malik', 'hisseli', 'vekaleten', 'sirket');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE inceleme_durumu AS ENUM ('beklemede', 'onaylandi', 'reddedildi');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) belge_turu enum'una gerekli DEGERLERI ekle ("tapu" dahil - canli
-- ortamda bu deger de eksikti).
ALTER TYPE belge_turu ADD VALUE IF NOT EXISTS 'tapu';
ALTER TYPE belge_turu ADD VALUE IF NOT EXISTS 'vekaletname';
ALTER TYPE belge_turu ADD VALUE IF NOT EXISTS 'imza_sirkuleri';

-- Yukarida eklenen enum degerlerini asagida (ayni script icinde) hemen
-- kullanabilmek icin transaction'i burada kapatiyoruz. Bu satir
-- olmadan "unsafe use of new value" hatasi alinabilir.
COMMIT;

-- 3) ihaleler tablosuna eksik sutunlari ekle (var olanlar atlanir)
ALTER TABLE public.ihaleler
  ADD COLUMN IF NOT EXISTS mulkiyet_durumu    mulkiyet_durumu_tipi,
  ADD COLUMN IF NOT EXISTS basvuru_sahibi_adi text,
  ADD COLUMN IF NOT EXISTS sirket_unvani      text,
  ADD COLUMN IF NOT EXISTS yetkili_kisi_adi   text,
  ADD COLUMN IF NOT EXISTS inceleme_durumu    inceleme_durumu NOT NULL DEFAULT 'beklemede',
  ADD COLUMN IF NOT EXISTS red_sebebi         text;

CREATE INDEX IF NOT EXISTS idx_ihaleler_inceleme_durumu ON public.ihaleler(inceleme_durumu);

-- 4) Reddedilen bir ihalenin red sebebi bos birakilamaz (kisit yoksa eklenir)
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
-- alanlarini guncelleyebilsin (policy yoksa eklenir)
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
-- (DROP IF EXISTS + CREATE ile idempotent - eski/yeni ad farketmeksizin guvenli)
DROP POLICY IF EXISTS "Tapu haricindeki belgeler herkese acik" ON public.belgeler;
DROP POLICY IF EXISTS "Hassas belgeler sadece admin, digerleri herkese acik" ON public.belgeler;
CREATE POLICY "Hassas belgeler sadece admin, digerleri herkese acik"
  ON public.belgeler FOR SELECT USING (
    tur NOT IN ('tapu', 'vekaletname', 'imza_sirkuleri')
    OR EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

-- ============================================================
-- DOGRULAMA - script bittikten sonra asagidaki sorguyu ayrica
-- calistirip sonucu paylasirsaniz her seyin dogru kuruldugunu
-- teyit edebiliriz:
--
-- select column_name from information_schema.columns
-- where table_schema='public' and table_name='ihaleler'
--   and column_name in ('mulkiyet_durumu','basvuru_sahibi_adi',
--     'sirket_unvani','yetkili_kisi_adi','inceleme_durumu','red_sebebi');
-- ============================================================
