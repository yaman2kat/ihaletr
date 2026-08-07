-- ============================================================
-- ULTRA GUVENLIK DENETIMI - TUM PARCALAR TEK DOSYADA (guncel/duzeltilmis hali)
-- Bu dosya asagidaki 3 migration'in NIHAI, birlestirilmis halidir:
--   1) ultra_guvenlik_denetimi_migration.sql
--   2) duzeltme_ek_migration.sql   (kullanicilar_ozet view duzeltmesi)
--   3) duzeltme_ek_migration2.sql  (guncelle_mevcut_teklif SECURITY DEFINER)
-- DOGRULAMA: odeme_kayitlari VAR, kullanicilar_ozet CALISIYOR, mevcut_teklif
-- ve rate limit trigger'lari canli testte PASSED. Bu dosyayi calistirmak
-- GUVENLI (tamamen idempotent) ama artik ZORUNLU degil -- referans/yedek
-- amaclidir. Hicbir veri kaybina yol acmaz.
-- ============================================================

-- ============================================================
-- 1) KRITIK: kullanicilar tablosu herkese acikti (anon key ile
-- kimlik dogrulamadan email/telefon/rol/kalan_teklif_hakki/plan_turu
-- TUM kullanicilar icin okunabiliyordu). Artik sadece kendi satiri +
-- admin. Genel goruntuleme icin kullanicilar_ozet view'i eklendi.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin');
$$;

DROP POLICY IF EXISTS "Herkes profilleri okuyabilir" ON public.kullanicilar;
DROP POLICY IF EXISTS "Kullanici kendi profilini ve admin herkesi gorebilir" ON public.kullanicilar;
CREATE POLICY "Kullanici kendi profilini ve admin herkesi gorebilir"
  ON public.kullanicilar FOR SELECT USING (
    auth.uid() = id OR public.is_admin()
  );

CREATE OR REPLACE FUNCTION public.email_kayitli_mi(p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.kullanicilar WHERE email = p_email);
$$;
GRANT EXECUTE ON FUNCTION public.email_kayitli_mi(text) TO anon, authenticated;

-- DUZELTILMIS HALI: security_invoker YOK (varsayilan false) -- view,
-- olusturan rolun yetkisiyle calisir ve kisitlayici RLS'i "atlar" (view
-- SELECT listesi zaten sadece herkese acik alanlarla sinirli, risk yok).
-- (Ilk denemede security_invoker=true yanlislikla kullanilmisti, bu
-- cagiran rolun kisitlayici RLS'ini view'e de uygulayip anon/authenticated
-- icin view'i BOS donduruyordu -- canli testte tespit edilip duzeltildi.)
CREATE OR REPLACE VIEW public.kullanicilar_ozet AS
SELECT id, ad_soyad, firma_adi, hesap_turu, avatar_url
FROM public.kullanicilar;

GRANT SELECT ON public.kullanicilar_ozet TO anon, authenticated;

-- ============================================================
-- 2) KRITIK: kullanicilar UPDATE politikasi sadece SATIR sahipligini
-- dogruluyordu (WITH CHECK yoktu), HANGI SUTUNUN degistigini
-- kisitlamiyordu. Bir kullanici dogrudan PATCH ile rol='admin' yapip
-- kendini admin yapabiliyor, kalan_teklif_hakki/plan_turu'nu sinirsiz
-- degere cekebiliyordu (canli PoC ile dogrulandi).
-- ============================================================

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
  THEN
    RAISE EXCEPTION 'KISITLI_ALAN_DEGISTIRILEMEZ: Bu alanlar yalnizca admin/sistem tarafindan degistirilebilir.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kullanici_kisitli_sutun_kontrol ON public.kullanicilar;
CREATE TRIGGER trg_kullanici_kisitli_sutun_kontrol
  BEFORE UPDATE ON public.kullanicilar
  FOR EACH ROW EXECUTE FUNCTION public.kullanici_kisitli_sutun_kontrol();

-- Sistemin kendi mesru guncellemelerine (teklif hakki dusurme, davet
-- odulu, oauth davet baglama, odeme sonrasi hak artirma) bypass bayragi.

CREATE OR REPLACE FUNCTION public.guncelle_kullanici_teklif_hakki()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
  UPDATE public.kullanicilar
  SET
    toplam_teklif_sayisi = toplam_teklif_sayisi + 1,
    kalan_teklif_hakki   = CASE
      WHEN kalan_teklif_hakki >= 99999 THEN kalan_teklif_hakki
      ELSE GREATEST(0, kalan_teklif_hakki - 1)
    END
  WHERE id = NEW.kullanici_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.artir_teklif_hakki(p_kullanici_id uuid, p_miktar integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yeni_hak integer;
BEGIN
  PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
  UPDATE public.kullanicilar
  SET kalan_teklif_hakki = kalan_teklif_hakki + p_miktar
  WHERE id = p_kullanici_id
  RETURNING kalan_teklif_hakki INTO yeni_hak;

  RETURN yeni_hak;
END;
$$;

CREATE OR REPLACE FUNCTION public.davet_odulunu_baslat(p_eden_id uuid, p_edilen_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hesap_turu  hesap_turu_tipi;
  v_ihale_id    uuid;
  v_aktif_sayi  integer;
BEGIN
  SELECT hesap_turu INTO v_hesap_turu FROM public.kullanicilar WHERE id = p_eden_id;

  IF v_hesap_turu = 'muteahhit' THEN
    PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
    UPDATE public.kullanicilar
    SET kalan_teklif_hakki = CASE
      WHEN kalan_teklif_hakki >= 99999 THEN kalan_teklif_hakki
      ELSE kalan_teklif_hakki + 1
    END
    WHERE id = p_eden_id;

    INSERT INTO public.davetler (davet_eden_id, davet_edilen_id, odul_verildi, odul_turu, odul_verildi_tarihi)
    VALUES (p_eden_id, p_edilen_id, true, 'teklif_hakki', now())
    ON CONFLICT (davet_edilen_id) DO NOTHING;

  ELSIF v_hesap_turu = 'arsa_sahibi' THEN
    SELECT count(*) INTO v_aktif_sayi FROM public.ihaleler WHERE olusturan_id = p_eden_id AND durum = 'aktif';

    IF v_aktif_sayi = 1 THEN
      SELECT id INTO v_ihale_id FROM public.ihaleler WHERE olusturan_id = p_eden_id AND durum = 'aktif';

      UPDATE public.ihaleler SET bitis_tarihi = bitis_tarihi + 15 WHERE id = v_ihale_id;

      INSERT INTO public.davetler (davet_eden_id, davet_edilen_id, odul_verildi, odul_turu, uygulanan_ihale_id, odul_verildi_tarihi)
      VALUES (p_eden_id, p_edilen_id, true, 'sure_uzatma', v_ihale_id, now())
      ON CONFLICT (davet_edilen_id) DO NOTHING;
    ELSE
      INSERT INTO public.davetler (davet_eden_id, davet_edilen_id, odul_turu)
      VALUES (p_eden_id, p_edilen_id, 'sure_uzatma')
      ON CONFLICT (davet_edilen_id) DO NOTHING;
    END IF;

  ELSE
    INSERT INTO public.davetler (davet_eden_id, davet_edilen_id)
    VALUES (p_eden_id, p_edilen_id)
    ON CONFLICT (davet_edilen_id) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.davet_odulu_uygula(
  p_davet_id  uuid,
  p_odul_turu odul_turu,
  p_ihale_id  uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_davet     public.davetler%ROWTYPE;
  v_odul_turu odul_turu;
BEGIN
  SELECT * INTO v_davet FROM public.davetler WHERE id = p_davet_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Davet bulunamadi';
  END IF;

  IF v_davet.davet_eden_id <> auth.uid() THEN
    RAISE EXCEPTION 'Bu davet size ait degil';
  END IF;

  IF v_davet.odul_verildi THEN
    RAISE EXCEPTION 'Bu davet icin odul zaten verildi';
  END IF;

  v_odul_turu := COALESCE(v_davet.odul_turu, p_odul_turu);

  IF v_odul_turu = 'teklif_hakki' THEN
    PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
    UPDATE public.kullanicilar
    SET kalan_teklif_hakki = CASE
      WHEN kalan_teklif_hakki >= 99999 THEN kalan_teklif_hakki
      ELSE kalan_teklif_hakki + 1
    END
    WHERE id = auth.uid();

  ELSIF v_odul_turu = 'sure_uzatma' THEN
    IF p_ihale_id IS NULL THEN
      RAISE EXCEPTION 'Ihale secimi zorunludur';
    END IF;

    UPDATE public.ihaleler
    SET bitis_tarihi = bitis_tarihi + 15
    WHERE id = p_ihale_id AND olusturan_id = auth.uid() AND durum = 'aktif';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ihale bulunamadi ya da size ait aktif bir ihale degil';
    END IF;
  END IF;

  UPDATE public.davetler
  SET odul_verildi        = true,
      odul_turu            = v_odul_turu,
      uygulanan_ihale_id   = p_ihale_id,
      odul_verildi_tarihi  = now()
  WHERE id = p_davet_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.oauth_kayit_tamamla(
  p_hesap_turu hesap_turu_tipi DEFAULT NULL,
  p_ref_kodu   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_eden_id  uuid;
  v_mevcut   uuid;
BEGIN
  IF p_hesap_turu IS NOT NULL THEN
    UPDATE public.kullanicilar SET hesap_turu = p_hesap_turu WHERE id = auth.uid();
  END IF;

  IF p_ref_kodu IS NOT NULL THEN
    SELECT davet_eden_id INTO v_mevcut FROM public.kullanicilar WHERE id = auth.uid();

    IF v_mevcut IS NULL THEN
      SELECT id INTO v_eden_id FROM public.kullanicilar WHERE davet_kodu = upper(p_ref_kodu);

      IF v_eden_id IS NOT NULL AND v_eden_id <> auth.uid() THEN
        PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
        UPDATE public.kullanicilar SET davet_eden_id = v_eden_id WHERE id = auth.uid();

        IF (SELECT email_confirmed_at FROM auth.users WHERE id = auth.uid()) IS NOT NULL THEN
          PERFORM public.davet_odulunu_baslat(v_eden_id, auth.uid());
        END IF;
      END IF;
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- 3) ORTA: belgeler INSERT politikasi, belgenin GERCEKTEN yukleyene
-- ait bir ihaleye eklendigini dogrulamiyordu -- herhangi bir kullanici
-- baskasinin ihalesine sahte tapu/belge satiri ekleyip admin
-- incelemesini karistirabilirdi.
-- ============================================================

DROP POLICY IF EXISTS "Giris yapan ya da misafir belge yukleyebilir" ON public.belgeler;
CREATE POLICY "Giris yapan ya da misafir belge yukleyebilir"
  ON public.belgeler FOR INSERT WITH CHECK (
    (
      (auth.uid() IS NOT NULL AND auth.uid() = yukleyen_id)
      OR (auth.uid() IS NULL AND yukleyen_id IS NULL)
    )
    AND (
      ihale_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.ihaleler
        WHERE id = ihale_id
          AND (olusturan_id = auth.uid() OR (olusturan_id IS NULL AND auth.uid() IS NULL))
      )
    )
  );

-- ============================================================
-- 4) ORTA: muteahhit_yorumlar INSERT politikasi kendine yorum yazmayi
-- (self-review) engellemiyordu.
-- ============================================================

DROP POLICY IF EXISTS "Giris yapan muteahhite yorum ekleyebilir" ON public.muteahhit_yorumlar;
CREATE POLICY "Giris yapan muteahhite yorum ekleyebilir"
  ON public.muteahhit_yorumlar FOR INSERT WITH CHECK (
    auth.uid() = kullanici_id AND muteahhit_id <> kullanici_id
  );

-- ============================================================
-- 5) KRITIK (canli testte sonradan bulundu): teklif veren kisi
-- ihalenin SAHIBI degilse (en yaygin/normal senaryo), mevcut_teklif
-- hicbir zaman guncellenmiyordu -- trigger bidder'in kendi oturumuyla
-- calisiyordu ve ihaleler UPDATE RLS'i (sadece sahibi/admin) bu
-- guncellemeyi SESSIZCE engelliyordu. SECURITY DEFINER ile duzeltildi.
-- Ayrica DELETE de trigger'a eklendi (hesap silme CASCADE'inde stale
-- veri kalmasin diye).
-- ============================================================

CREATE OR REPLACE FUNCTION public.guncelle_mevcut_teklif()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ihale_id uuid := COALESCE(NEW.ihale_id, OLD.ihale_id);
BEGIN
  UPDATE public.ihaleler
  SET
    mevcut_teklif = (SELECT MIN(tutar) FROM public.teklifler WHERE ihale_id = v_ihale_id),
    updated_at    = now()
  WHERE id = v_ihale_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_teklif_degisti ON public.teklifler;
CREATE TRIGGER on_teklif_degisti
  AFTER INSERT OR UPDATE OR DELETE ON public.teklifler
  FOR EACH ROW EXECUTE FUNCTION public.guncelle_mevcut_teklif();

-- ============================================================
-- 6) YUKSEK: ihale olusturmada hic hiz siniri yoktu -- bir kullanici
-- sinirsiz ihale acip platformu spam'leyebilirdi (canli testte
-- dogrulandi: 10 ardisik istek 10/10 basarili oldu).
-- ============================================================

CREATE OR REPLACE FUNCTION public.ihale_olusturma_hiz_siniri()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  son_saat_sayisi integer;
BEGIN
  IF NEW.olusturan_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO son_saat_sayisi
  FROM public.ihaleler
  WHERE olusturan_id = NEW.olusturan_id
    AND created_at > now() - interval '1 hour';

  IF son_saat_sayisi >= 10 THEN
    RAISE EXCEPTION 'HIZ_SINIRI_ASILDI: Saatte en fazla 10 ihale olusturabilirsiniz.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ihale_olusturma_hiz_siniri ON public.ihaleler;
CREATE TRIGGER trg_ihale_olusturma_hiz_siniri
  BEFORE INSERT ON public.ihaleler
  FOR EACH ROW EXECUTE FUNCTION public.ihale_olusturma_hiz_siniri();

-- ============================================================
-- 7) YUKSEK: odeme_kayitlari tablosu -- audit log + kart deneme
-- (card testing) rate limiting + odeme/kredi mutabakat kaydi.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.odeme_kayitlari (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kullanici_id      uuid        NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  paket             text        NOT NULL,
  iyzico_payment_id text,
  durum             text        NOT NULL CHECK (durum IN ('basarili', 'basarisiz', 'db_guncelleme_hatasi')),
  hata_mesaji       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_odeme_kayitlari_kullanici ON public.odeme_kayitlari(kullanici_id, created_at);

ALTER TABLE public.odeme_kayitlari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kullanici kendi odeme kayitlarini gorebilir" ON public.odeme_kayitlari;
CREATE POLICY "Kullanici kendi odeme kayitlarini gorebilir"
  ON public.odeme_kayitlari FOR SELECT USING (auth.uid() = kullanici_id);

DROP POLICY IF EXISTS "Admin tum odeme kayitlarini gorebilir" ON public.odeme_kayitlari;
CREATE POLICY "Admin tum odeme kayitlarini gorebilir"
  ON public.odeme_kayitlari FOR SELECT USING (public.is_admin());

-- DOGRULAMA (hepsi sonuc donmeli / dogru deger gostermeli)
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kullanicilar';
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname IN (
  'trg_kullanici_kisitli_sutun_kontrol', 'on_teklif_degisti', 'trg_ihale_olusturma_hiz_siniri'
);
SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('guncelle_mevcut_teklif', 'artir_teklif_hakki', 'is_admin');
-- guncelle_mevcut_teklif, artir_teklif_hakki, is_admin -> prosecdef = true (SECURITY DEFINER) olmali
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'odeme_kayitlari';
SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'kullanicilar_ozet';
