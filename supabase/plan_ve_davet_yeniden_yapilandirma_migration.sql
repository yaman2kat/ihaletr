-- ============================================================
-- İhaleTR — Plan yapısı ve davet sistemi yeniden yapılandırması
-- Supabase Dashboard > SQL Editor > New Query'e yapıştırıp çalıştırın.
-- Idempotent: birden fazla kez çalıştırılabilir.
--
-- Kapsam:
--  1) Ücretsiz arsa sahibi: ihale sayısı sınırsız (tek kullanımlık hak
--     kaldırıldı), süre yine en fazla 5 gün, uzatma hakkı yok.
--  2) Premium: aylık abonelik değil TEK SEFERLİK satın alma. 45 güne
--     kadar ilk süre + 45 günlük, farklı ihalelere dağıtılabilir
--     "uzatma havuzu".
--  3) Kurumsal: aynen korunuyor (aylık abonelik, mevcut uzatma mantığı).
--  4) Müteahhit ücretsiz teklif hakkı kaldırıldı (varsayılan artık 0).
--  5) Arsa sahibi davet sistemi tamamen kaldırıldı.
--  6) Müteahhit davet sistemi yeniden yazıldı: ödül yalnızca davet
--     edilenin GERÇEKTEN teklif vermesi/ihale açmasıyla, ayda en fazla
--     1 kez kazanılır.
-- ============================================================

-- ------------------------------------------------------------
-- 1) kullanicilar: yeni kolon + varsayılan değişiklikleri
-- ------------------------------------------------------------

ALTER TABLE public.kullanicilar
  ADD COLUMN IF NOT EXISTS uzatma_havuzu_gun integer NOT NULL DEFAULT 0;

ALTER TABLE public.kullanicilar
  ALTER COLUMN kalan_teklif_hakki SET DEFAULT 0;

-- ------------------------------------------------------------
-- 2) davet_kullanim_loglari — yeni davet aktivasyon geçmişi
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.davet_kullanim_loglari (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  davet_eden_id     uuid        NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  davet_edilen_id   uuid        NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  aktivasyon_tarihi timestamptz NOT NULL DEFAULT now(),
  aktivasyon_turu   text        NOT NULL CHECK (aktivasyon_turu IN ('teklif', 'ihale')),
  ay_yil            text        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_davet_loglari_eden_ay ON public.davet_kullanim_loglari(davet_eden_id, ay_yil);

ALTER TABLE public.davet_kullanim_loglari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Davet eden kendi loglarini gorebilir" ON public.davet_kullanim_loglari;
CREATE POLICY "Davet eden kendi loglarini gorebilir"
  ON public.davet_kullanim_loglari FOR SELECT USING (auth.uid() = davet_eden_id);

-- INSERT icin kasitli olarak hicbir politika yok: yalnizca asagidaki
-- SECURITY DEFINER RPC (davet_kodu_aktivasyonu) RLS'i atlayarak yazar.

-- ------------------------------------------------------------
-- 3) Eski "Arkadaşını Davet Et" altyapısını kaldır (arsa sahibi süre
--    uzatma ödülü + kayıt anında otomatik ödül tamamen bitti)
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
DROP FUNCTION IF EXISTS public.handle_davet_odul_kaydi();
DROP FUNCTION IF EXISTS public.davet_odulu_uygula(uuid, odul_turu, uuid);
DROP FUNCTION IF EXISTS public.davet_odulunu_baslat(uuid, uuid);
-- trg_bildirim_davet_odulu, davetler tablosuna bagliydi; tablo DROP
-- edilince CASCADE ile trigger da gider, ama tetikleyici fonksiyon
-- ayrica temizlenir (artik hicbir yerden cagrilmiyor).
DROP FUNCTION IF EXISTS public.bildirim_davet_odulu() CASCADE;
DROP TABLE IF EXISTS public.davetler CASCADE;
DROP TYPE IF EXISTS odul_turu;

-- handle_new_user(): artik kayit anında davet_eden_id cozumlemiyor/
-- yazmiyor (referans kodu artik yalnizca teklif/ihale formundaki
-- aktivasyon kutusuyla islenir) ve yeni muteahhit/arsa sahibi hesabina
-- ucretsiz teklif hakki vermiyor (kalan_teklif_hakki = 0).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hesap_turu hesap_turu_tipi;
BEGIN
  v_hesap_turu := CASE NEW.raw_user_meta_data->>'hesap_turu'
    WHEN 'muteahhit' THEN 'muteahhit'::hesap_turu_tipi
    WHEN 'her_ikisi' THEN 'her_ikisi'::hesap_turu_tipi
    ELSE 'arsa_sahibi'::hesap_turu_tipi
  END;

  INSERT INTO public.kullanicilar
    (id, email, ad_soyad, davet_kodu, hesap_turu, kalan_teklif_hakki)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'ad_soyad', split_part(NEW.email, '@', 1)),
    public.gen_davet_kodu(),
    v_hesap_turu,
    0
  );

  INSERT INTO public.bildirim_tercihleri (kullanici_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- oauth_kayit_tamamla(): davet kodu / odul tetikleme kismi tamamen
-- kaldirildi, yalnizca hesap_turu guncellemesi kaldi.
CREATE OR REPLACE FUNCTION public.oauth_kayit_tamamla(
  p_hesap_turu hesap_turu_tipi DEFAULT NULL,
  p_ref_kodu   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_hesap_turu IS NOT NULL THEN
    UPDATE public.kullanicilar SET hesap_turu = p_hesap_turu WHERE id = auth.uid();
  END IF;
  -- p_ref_kodu artik islenmiyor (geriye donuk uyumluluk icin parametre
  -- korundu, cagiran taraf guncellenene kadar hata vermesin diye).
END;
$$;

-- ------------------------------------------------------------
-- 4) bildirimler: yeni tur "davet_limit_asildi"
-- ------------------------------------------------------------

ALTER TABLE public.bildirimler DROP CONSTRAINT IF EXISTS bildirimler_tur_check;
ALTER TABLE public.bildirimler ADD CONSTRAINT bildirimler_tur_check CHECK (tur IN (
  'yeni_teklif', 'ihale_onaylandi', 'ihale_reddedildi', 'ihale_otomatik_sonlandi',
  'davet_odulu', 'odeme_sorunu', 'bolge_eslesmesi', 'davet_limit_asildi'
));

-- ------------------------------------------------------------
-- 5) Yeni davet aktivasyon RPC'si
--    Davet edilen kisi (auth.uid()) bir davet kodu ile GERCEKTEN teklif
--    verdiginde/ihale actiginde cagrilir. Davet eden kisiye, o ay
--    icinde bu yoldan zaten hak kazanmadiysa +1 teklif hakki verir.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.davet_kodu_aktivasyonu(
  p_davet_kodu     text,
  p_aktivasyon_turu text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_eden_id  uuid;
  v_ay_yil   text := to_char(now(), 'YYYY-MM');
  v_bu_ay_sayi integer;
BEGIN
  IF auth.uid() IS NULL OR p_davet_kodu IS NULL OR trim(p_davet_kodu) = '' THEN
    RETURN;
  END IF;

  IF p_aktivasyon_turu NOT IN ('teklif', 'ihale') THEN
    RETURN;
  END IF;

  SELECT id INTO v_eden_id FROM public.kullanicilar WHERE davet_kodu = upper(trim(p_davet_kodu));

  -- Kod bulunamadi ya da kullanici kendi kodunu kullanmaya calisiyor.
  IF v_eden_id IS NULL OR v_eden_id = auth.uid() THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_bu_ay_sayi
  FROM public.davet_kullanim_loglari
  WHERE davet_eden_id = v_eden_id AND ay_yil = v_ay_yil;

  IF v_bu_ay_sayi >= 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.bildirimler
      WHERE kullanici_id = v_eden_id AND tur = 'davet_limit_asildi'
        AND created_at >= date_trunc('month', now())
    ) THEN
      INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, link)
      VALUES (
        v_eden_id, 'davet_limit_asildi', 'Bu ay davet limitinize ulaştınız',
        'Davet yoluyla ayda en fazla 1 teklif hakkı kazanabilirsiniz, bu ayki hakkınızı zaten kullandınız.',
        '/panel'
      );
    END IF;
    RETURN;
  END IF;

  INSERT INTO public.davet_kullanim_loglari (davet_eden_id, davet_edilen_id, aktivasyon_turu, ay_yil)
  VALUES (v_eden_id, auth.uid(), p_aktivasyon_turu, v_ay_yil);

  PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
  UPDATE public.kullanicilar
  SET kalan_teklif_hakki = CASE
    WHEN kalan_teklif_hakki >= 99999 THEN kalan_teklif_hakki
    ELSE kalan_teklif_hakki + 1
  END
  WHERE id = v_eden_id;

  INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, link)
  VALUES (
    v_eden_id, 'davet_odulu', 'Davet ödülünüz uygulandı',
    'Davetiniz kabul edildi ve +1 teklif hakkı kazandınız.',
    '/panel'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.davet_kodu_aktivasyonu(text, text) TO authenticated;

-- ------------------------------------------------------------
-- 6) İhale süre ekleme RPC'si — Premium uzatma havuzundan düşer
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ihale_suresini_uzat(
  p_ihale_id uuid,
  p_gun      integer
)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_havuz     integer;
  v_yeni_tarih date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Giris yapmalisiniz.';
  END IF;

  IF p_gun IS NULL OR p_gun <= 0 THEN
    RAISE EXCEPTION 'Gecerli bir gun sayisi girin.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ihaleler WHERE id = p_ihale_id AND olusturan_id = auth.uid() AND durum = 'aktif'
  ) THEN
    RAISE EXCEPTION 'Bu ihale size ait aktif bir ihale degil.';
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

-- ------------------------------------------------------------
-- 7) Premium satin alma RPC'si — uzatma havuzuna +45 gun ekler
--    (yalnizca service_role -- api/odeme/route.ts)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.premium_havuz_ekle(p_kullanici_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yeni_havuz integer;
BEGIN
  PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
  UPDATE public.kullanicilar
  SET uzatma_havuzu_gun = uzatma_havuzu_gun + 45
  WHERE id = p_kullanici_id
  RETURNING uzatma_havuzu_gun INTO v_yeni_havuz;

  RETURN v_yeni_havuz;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.premium_havuz_ekle(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.premium_havuz_ekle(uuid) TO service_role;

-- ------------------------------------------------------------
-- 8) kullanici_kisitli_sutun_kontrol(): uzatma_havuzu_gun de artik
--    yalnizca admin/sistem tarafindan degistirilebilen kisitli bir alan.
-- ------------------------------------------------------------

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
  THEN
    RAISE EXCEPTION 'KISITLI_ALAN_DEGISTIRILEMEZ: Bu alanlar yalnizca admin/sistem tarafindan degistirilebilir.';
  END IF;

  RETURN NEW;
END;
$$;

-- DOGRULAMA
SELECT column_name, column_default FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'kullanicilar'
  AND column_name IN ('uzatma_havuzu_gun', 'kalan_teklif_hakki');
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'davet_kullanim_loglari';
SELECT proname FROM pg_proc WHERE proname IN (
  'davet_kodu_aktivasyonu', 'ihale_suresini_uzat', 'premium_havuz_ekle', 'handle_new_user', 'oauth_kayit_tamamla'
);
SELECT proname FROM pg_proc WHERE proname IN ('davet_odulu_uygula', 'davet_odulunu_baslat', 'handle_davet_odul_kaydi');
