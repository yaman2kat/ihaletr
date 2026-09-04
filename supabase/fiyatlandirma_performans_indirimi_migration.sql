-- ============================================================
-- İhaleTR — Fiyatlandırma & Paket Sistemi Güncellemesi
-- Supabase Dashboard > SQL Editor > New Query'e yapıştırıp çalıştırın.
-- (Mevcut canlı veritabanına uygulanacak, ALTER/CREATE OR REPLACE
--  tabanlı, yıkıcı olmayan bir migration'dır.)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Ücretsiz plan: "1 ihale hakkı" artık TEK KULLANIMLIKTIR.
--    Kullanıcı ilk ihalesini yayınladığında bu alan true olur;
--    ikinci ihale denemesi uygulama katmanında (ihale-olustur
--    sayfası) bu alana bakılarak engellenir.
-- ------------------------------------------------------------

ALTER TABLE public.kullanicilar
  ADD COLUMN IF NOT EXISTS ucretsiz_ihale_hakki_kullanildi boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 2) Müteahhit performans indirimi (Armut.com benzeri):
--    - Sınırsız teklif paketi sahibi (kalan_teklif_hakki >= 99999)
--    - En az 10 yorum
--    - Ortalama puan >= 4.5
--    şartlarının TÜMÜNÜ sağlayan müteahhitlere teklif paketi
--    ücretlerinde %50 indirim uygulanır.
--
--    kalan_teklif_hakki, kullanicilar tablosunda HASSAS bir alan
--    olarak işaretlenmiştir (bkz. schema.sql). Bu fonksiyon ham
--    değeri değil yalnızca bir boolean döndürür ve yalnızca
--    kendi hesabınız (auth.uid() = p_kullanici_id) ya da servis
--    rolü için hesaplama yapar — başka bir kullanıcının paket/plan
--    bilgisi bu fonksiyon üzerinden sızdırılamaz.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.performans_indirimi_uygulanir_mi(p_kullanici_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sinirsiz_paket boolean;
  v_ortalama_puan  numeric;
  v_yorum_sayisi    integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_kullanici_id AND auth.role() <> 'service_role' THEN
    RETURN false;
  END IF;

  SELECT COALESCE(kalan_teklif_hakki, 0) >= 99999
    INTO v_sinirsiz_paket
    FROM public.kullanicilar
    WHERE id = p_kullanici_id;

  SELECT AVG(puan), COUNT(*)
    INTO v_ortalama_puan, v_yorum_sayisi
    FROM public.muteahhit_yorumlar
    WHERE muteahhit_id = p_kullanici_id;

  RETURN COALESCE(v_sinirsiz_paket, false)
     AND COALESCE(v_yorum_sayisi, 0) >= 10
     AND COALESCE(v_ortalama_puan, 0) >= 4.5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.performans_indirimi_uygulanir_mi(uuid) TO authenticated, service_role;

-- DOGRULAMA
SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'kullanicilar' AND column_name = 'ucretsiz_ihale_hakki_kullanildi';
SELECT proname FROM pg_proc WHERE proname = 'performans_indirimi_uygulanir_mi';
