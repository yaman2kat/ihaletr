-- ============================================================
-- İhaleTR — "Arkadaşını Davet Et" özelliği için CANLI DB migration'ı.
-- Bu dosyayı Supabase Dashboard > SQL Editor'e yapıştırıp çalıştırın.
-- supabase/schema.sql'in TAMAMINI ÇALIŞTIRMAYIN — o dosyanın başındaki
-- DROP TABLE blokları mevcut TÜM VERİYİ siler. Bu dosya sadece yeni
-- eklenen parçaları içerir ve mevcut verilerinize dokunmaz.
-- ============================================================

-- 1) kullanicilar tablosuna yeni sütunlar
ALTER TABLE public.kullanicilar
  ADD COLUMN IF NOT EXISTS davet_kodu    text UNIQUE,
  ADD COLUMN IF NOT EXISTS davet_eden_id uuid REFERENCES public.kullanicilar(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kullanicilar_davet_eden ON public.kullanicilar(davet_eden_id);

-- 2) handle_new_user()'ı davet kodu üretecek/bağlayacak şekilde güncelle
-- Yeni auth kaydında otomatik profil oluştur.
-- Kayıt sırasında bir davet kodu geldiyse (davet_referans_kodu), davet
-- eden kullanıcıyı bul ve davet_eden_id'yi bağla. E-posta doğrulaması
-- kapalı bir projede kullanıcı anında onaylı geldiyse (email_confirmed_at
-- dolu), ödül kaydını burada oluştur — aksi halde bu iş
-- handle_davet_odul_kaydi() tetikleyicisiyle e-posta onayında yapılır.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_davet_eden_id uuid;
BEGIN
  SELECT id INTO v_davet_eden_id
  FROM public.kullanicilar
  WHERE davet_kodu = NEW.raw_user_meta_data->>'davet_referans_kodu';

  INSERT INTO public.kullanicilar (id, email, ad_soyad, davet_kodu, davet_eden_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'ad_soyad', split_part(NEW.email, '@', 1)),
    public.gen_davet_kodu(),
    v_davet_eden_id
  );

  IF v_davet_eden_id IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.davetler (davet_eden_id, davet_edilen_id)
    VALUES (v_davet_eden_id, NEW.id)
    ON CONFLICT (davet_edilen_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Davet sistemi: tip, tablo, fonksiyonlar, tetikleyici, RPC
-- Her kullanıcının benzersiz bir davet_kodu'su vardır (bkz. handle_new_user).
-- Yeni kullanıcı bu kodla kayıt olup e-postasını onaylayınca davet eden
-- kişi için "davetler" tablosunda ödülü henüz seçilmemiş bir kayıt açılır.
-- Ödül seçimi (teklif hakkı / süre uzatma) davet eden kişi tarafından
-- panelden yapılır ve davet_odulu_uygula() RPC'si ile uygulanır.
-- ------------------------------------------------------------

CREATE TYPE odul_turu AS ENUM ('teklif_hakki', 'sure_uzatma');

-- Benzersiz, 8 karakterlik davet kodu üretir.
CREATE OR REPLACE FUNCTION public.gen_davet_kodu()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_kod text;
BEGIN
  LOOP
    v_kod := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.kullanicilar WHERE davet_kodu = v_kod);
  END LOOP;
  RETURN v_kod;
END;
$$;

-- Bu SQL sıfırdan kurulumda no-op'tur (kullanicilar boş); canlı bir
-- projeye bu bölüm eklendiğinde mevcut kullanıcılara davet kodu atar.
UPDATE public.kullanicilar SET davet_kodu = public.gen_davet_kodu() WHERE davet_kodu IS NULL;

CREATE TABLE public.davetler (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  davet_eden_id        uuid        NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  davet_edilen_id      uuid        NOT NULL UNIQUE REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  odul_verildi         boolean     NOT NULL DEFAULT false,
  odul_turu            odul_turu,
  uygulanan_ihale_id   uuid        REFERENCES public.ihaleler(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  odul_verildi_tarihi  timestamptz
);

CREATE INDEX idx_davetler_eden  ON public.davetler(davet_eden_id);
CREATE INDEX idx_davetler_durum ON public.davetler(odul_verildi);

ALTER TABLE public.davetler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Davet eden kendi davetlerini gorebilir"
  ON public.davetler FOR SELECT USING (auth.uid() = davet_eden_id);

-- E-posta onaylanınca (email_confirmed_at NULL'dan dolu hale geçince)
-- davet eden kişi için bekleyen ödül kaydını aç.
CREATE OR REPLACE FUNCTION public.handle_davet_odul_kaydi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.davetler (davet_eden_id, davet_edilen_id)
    SELECT k.davet_eden_id, k.id
    FROM public.kullanicilar k
    WHERE k.id = NEW.id AND k.davet_eden_id IS NOT NULL
    ON CONFLICT (davet_edilen_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_davet_odul_kaydi();

-- Davet eden kişi ödülünü seçip uygular. auth.uid() ile davet_eden_id
-- eşleşmesi ve daha önce ödül verilmediği kontrol edilir; bu yüzden
-- SECURITY DEFINER olmasına rağmen anon-key ile çağrılması güvenlidir.
CREATE OR REPLACE FUNCTION public.davet_odulu_uygula(
  p_davet_id  uuid,
  p_odul_turu odul_turu,
  p_ihale_id  uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_davet public.davetler%ROWTYPE;
BEGIN
  SELECT * INTO v_davet FROM public.davetler WHERE id = p_davet_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Davet bulunamadı';
  END IF;

  IF v_davet.davet_eden_id <> auth.uid() THEN
    RAISE EXCEPTION 'Bu davet size ait değil';
  END IF;

  IF v_davet.odul_verildi THEN
    RAISE EXCEPTION 'Bu davet için ödül zaten verildi';
  END IF;

  IF p_odul_turu = 'teklif_hakki' THEN
    UPDATE public.kullanicilar
    SET kalan_teklif_hakki = CASE
      WHEN kalan_teklif_hakki >= 99999 THEN kalan_teklif_hakki
      ELSE kalan_teklif_hakki + 1
    END
    WHERE id = auth.uid();

  ELSIF p_odul_turu = 'sure_uzatma' THEN
    IF p_ihale_id IS NULL THEN
      RAISE EXCEPTION 'İhale seçimi zorunludur';
    END IF;

    UPDATE public.ihaleler
    SET bitis_tarihi = bitis_tarihi + 15
    WHERE id = p_ihale_id AND olusturan_id = auth.uid() AND durum = 'aktif';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'İhale bulunamadı ya da size ait aktif bir ihale değil';
    END IF;
  END IF;

  UPDATE public.davetler
  SET odul_verildi        = true,
      odul_turu            = p_odul_turu,
      uygulanan_ihale_id   = p_ihale_id,
      odul_verildi_tarihi  = now()
  WHERE id = p_davet_id;
END;
$$;
