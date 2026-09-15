-- ============================================================
-- DÖRT DÜZELTME — İhaleyi Uzat sahiplik sıkılaştırması, 48 saat
-- kala süre uyarısı (site-içi + e-posta), ve daha önce ayrı bir
-- dosyada (email_gonderim_migration.sql) yazılıp schema.sql'e hiç
-- yansıtılmamış sütunların şemayla senkronize edilmesi.
--
-- Not: teklifler tablosundaki "kendi ihalesine teklif veremez" RLS
-- politikası canlı ortamda test edildi ve ZATEN doğru çalışıyor
-- (bkz. özet) -- bu migration'da dokunulmadı.
--
-- Supabase Dashboard > SQL Editor'a yapıştırıp çalıştırın.
-- ============================================================

-- ------------------------------------------------------------
-- 1. İHALEYİ UZAT — sahiplik RLS/RPC seviyesinde sıkılaştırma
--
-- "Premium" tarafı (ihale_suresini_uzat) zaten yalnızca
-- olusturan_id=auth.uid() ile çalışıyordu (admin bypass'ı hiç
-- yoktu); buraya ayrıca inceleme_durumu='onaylandi' kontrolü eklendi.
--
-- "Kurumsal" tarafı ise şimdiye kadar İSTEMCİDEN DOĞRUDAN bir
-- .update() çağrısıyla çalışıyordu. Bu satır, yalnızca "Olusturan
-- ihalesini guncelleyebilir" RLS politikasına güveniyordu -- ama
-- "Admin ihaleyi inceleyebilir" politikası SÜTUN bazlı bir kısıtlama
-- yapmadığından, teorik olarak bir admin (arayüzde bu buton hiç
-- görünmese bile) doğrudan aynı update çağrısını yaparak BAŞKASININ
-- ihalesinin bitiş tarihini uzatabilirdi. Bu artık mümkün değil:
-- Kurumsal tarafı da Premium ile aynı desende, sahiplik kontrolünü
-- SECURITY DEFINER içinde bağımsız olarak garanti eden yeni bir
-- RPC'ye taşındı.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ihale_suresini_uzat(
  p_ihale_id uuid,
  p_gun      integer
)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_havuz      integer;
  v_yeni_tarih date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Giris yapmalisiniz.';
  END IF;

  IF p_gun IS NULL OR p_gun <= 0 THEN
    RAISE EXCEPTION 'Gecerli bir gun sayisi girin.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ihaleler
    WHERE id = p_ihale_id
      AND olusturan_id = auth.uid()
      AND durum = 'aktif'
      AND inceleme_durumu = 'onaylandi'
      AND bitis_tarihi >= CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'Bu ihale size ait aktif bir ihale degil ya da suresi zaten dolmus.';
  END IF;

  SELECT uzatma_havuzu_gun INTO v_havuz FROM public.kullanicilar WHERE id = auth.uid() FOR UPDATE;

  IF v_havuz IS NULL OR v_havuz < p_gun THEN
    RAISE EXCEPTION 'UZATMA_HAVUZU_YETERSIZ: Uzatma havuzunuzda yeterli gun yok.';
  END IF;

  PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);

  UPDATE public.kullanicilar
  SET uzatma_havuzu_gun = uzatma_havuzu_gun - p_gun
  WHERE id = auth.uid();

  UPDATE public.ihaleler
  SET bitis_tarihi = bitis_tarihi + p_gun, updated_at = now()
  WHERE id = p_ihale_id
  RETURNING bitis_tarihi INTO v_yeni_tarih;

  RETURN v_yeni_tarih;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_suresini_uzat(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.ihale_uzat_kurumsal(
  p_ihale_id uuid,
  p_gun      integer
)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ihale           public.ihaleler%ROWTYPE;
  v_plan_turu       text;
  v_gecen_gun       integer;
  v_kalan_hak       integer;
  v_yeni_tarih      date;
  -- src/lib/plan-limitleri.ts > PLAN_EKSTRA_UZATMA_GUNU.kurumsal ile
  -- senkron tutulmali.
  v_kurumsal_limit CONSTANT integer := 30;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Giris yapmalisiniz.';
  END IF;

  IF p_gun IS NULL OR p_gun <= 0 THEN
    RAISE EXCEPTION 'Gecerli bir gun sayisi girin.';
  END IF;

  SELECT * INTO v_ihale FROM public.ihaleler
  WHERE id = p_ihale_id
    AND olusturan_id = auth.uid()
    AND durum = 'aktif'
    AND inceleme_durumu = 'onaylandi'
    AND bitis_tarihi >= CURRENT_DATE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bu ihale size ait aktif bir ihale degil ya da suresi zaten dolmus.';
  END IF;

  SELECT plan_turu INTO v_plan_turu FROM public.kullanicilar WHERE id = auth.uid();
  IF v_plan_turu IS DISTINCT FROM 'kurumsal' THEN
    RAISE EXCEPTION 'Bu islem yalnizca Kurumsal plan icin gecerlidir.';
  END IF;

  v_gecen_gun := v_ihale.bitis_tarihi - v_ihale.baslangic_tarihi;
  v_kalan_hak := GREATEST(0, v_kurumsal_limit - v_gecen_gun);
  IF p_gun > v_kalan_hak THEN
    RAISE EXCEPTION 'UZATMA_LIMITI_ASILDI: En fazla % gun uzatabilirsiniz.', v_kalan_hak;
  END IF;

  UPDATE public.ihaleler
  SET bitis_tarihi = bitis_tarihi + p_gun, updated_at = now()
  WHERE id = p_ihale_id
  RETURNING bitis_tarihi INTO v_yeni_tarih;

  RETURN v_yeni_tarih;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_uzat_kurumsal(uuid, integer) TO authenticated;

-- ------------------------------------------------------------
-- 2. ŞEMA SENKRONİZASYONU — email_gonderim_migration.sql daha önce
-- çalıştırılmış ama schema.sql'e hiç yansıtılmamış; burada telafi
-- ediliyor (fresh install de aynı sütunlara sahip olsun diye).
-- ------------------------------------------------------------

ALTER TABLE public.kullanicilar
  ADD COLUMN IF NOT EXISTS email_sure_uyarisi boolean NOT NULL DEFAULT true;

-- ------------------------------------------------------------
-- 3. 48 SAAT KALA SÜRE UYARISI — son_uyari_gonderildi (timestamptz)
--
-- Eski sure_uyarisi_gonderildi (boolean) sütunu, YALNIZCA e-postayı
-- (yalnızca ihale sahibine) tekrar göndermeyi engelliyordu. Yeni
-- sütun hem site-içi bildirimi hem e-postayı (hem sahibe hem teklif
-- verenlere) kapsayan tek bir "işlendi" zaman damgası olarak kullanılır.
-- Daha önce true olarak işaretlenmiş satırlar, migration sonrası
-- hemen yeniden işlenip herkese aniden ikinci bir e-posta patlaması
-- göndermesin diye now() ile taşınır.
-- ------------------------------------------------------------

ALTER TABLE public.ihaleler
  ADD COLUMN IF NOT EXISTS son_uyari_gonderildi timestamptz;

UPDATE public.ihaleler
SET son_uyari_gonderildi = now()
WHERE sure_uyarisi_gonderildi = true AND son_uyari_gonderildi IS NULL;

ALTER TABLE public.ihaleler DROP COLUMN IF EXISTS sure_uyarisi_gonderildi;

-- Yeni bildirim türü: "sure_uyarisi". Mevcut CHECK kısıtlaması,
-- schema.sql'in ilk sürümünden beri farklı migration'larda parça
-- parça genişletilmiş (bolge_eslesmesi, teklif_ikazi vb.) -- burada
-- güncel TAM liste + yeni tür ile yeniden tanımlanıyor.
ALTER TABLE public.bildirimler DROP CONSTRAINT IF EXISTS bildirimler_tur_check;
ALTER TABLE public.bildirimler ADD CONSTRAINT bildirimler_tur_check CHECK (tur IN (
  'yeni_teklif', 'ihale_onaylandi', 'ihale_reddedildi', 'ihale_otomatik_sonlandi',
  'davet_odulu', 'odeme_sorunu', 'bolge_eslesmesi', 'ihale_kapatildi',
  'ihale_kazanildi', 'ihale_kaybedildi', 'davet_limit_asildi', 'teklif_ikazi',
  'sure_uyarisi'
));
