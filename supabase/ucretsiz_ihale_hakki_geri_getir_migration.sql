-- ============================================================
-- İhaleTR — Ücretsiz ihale hakkını tekrar tek kullanımlık yap
-- Supabase Dashboard > SQL Editor > New Query'e yapıştırıp çalıştırın.
-- Idempotent: birden fazla kez çalıştırılabilir.
--
-- Önceki bir turda ücretsiz planın "sınırsız ihale" olacak şekilde
-- değiştirilmesiyle birlikte kullanılmaz hale gelen
-- ucretsiz_ihale_hakki_kullanildi kolonu tekrar aktif hale getiriliyor
-- (kolon zaten mevcuttu, DROP edilmemişti — yalnızca uygulama kodu
-- tekrar kullanıyor). Bu migration'ın tek gerçek işi: kullanıcının
-- kendi PATCH isteğiyle bu alanı true'dan false'a geri çevirip
-- ücretsiz hakkı sıfırlamasını (ihale-olustur/page.tsx'teki meşru
-- false→true güncellemesini bozmadan) engellemek.
-- ============================================================

ALTER TABLE public.kullanicilar
  ADD COLUMN IF NOT EXISTS ucretsiz_ihale_hakki_kullanildi boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.kullanici_kisitli_sutun_kontrol()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF current_setting('ihaletr.sistem_guncellemesi', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.rol IS DISTINCT FROM OLD.rol
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.kalan_teklif_hakki IS DISTINCT FROM OLD.kalan_teklif_hakki
     OR NEW.toplam_teklif_sayisi IS DISTINCT FROM OLD.toplam_teklif_sayisi
     OR NEW.plan_turu IS DISTINCT FROM OLD.plan_turu
     OR NEW.premium_bitis_tarihi IS DISTINCT FROM OLD.premium_bitis_tarihi
     OR NEW.davet_kodu IS DISTINCT FROM OLD.davet_kodu
     OR NEW.davet_eden_id IS DISTINCT FROM OLD.davet_eden_id
     OR NEW.uzatma_havuzu_gun IS DISTINCT FROM OLD.uzatma_havuzu_gun
     -- ucretsiz_ihale_hakki_kullanildi: kullanici kendi ihale-olustur
     -- akisinda false->true gecisini kendi PATCH'iyle yapar (meşru akış),
     -- ama true->false'a geri cevirip hakkini "sifirlayamaz".
     OR (OLD.ucretsiz_ihale_hakki_kullanildi AND NOT COALESCE(NEW.ucretsiz_ihale_hakki_kullanildi, false))
  THEN
    RAISE EXCEPTION 'KISITLI_ALAN_DEGISTIRILEMEZ: Bu alanlar yalnizca admin/sistem tarafindan degistirilebilir.';
  END IF;

  RETURN NEW;
END;
$$;

-- DOGRULAMA
SELECT column_name, column_default FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'kullanicilar' AND column_name = 'ucretsiz_ihale_hakki_kullanildi';
SELECT proname FROM pg_proc WHERE proname = 'kullanici_kisitli_sutun_kontrol';
