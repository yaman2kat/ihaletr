-- ============================================================
-- İhaleTR — "Hesap türlerini ayır" özelliği için CANLI DB migration'ı.
-- Bu dosyayı Supabase Dashboard > SQL Editor'e yapıştırıp çalıştırın.
-- ÖNKOŞUL: supabase/davet_migration.sql daha önce uygulanmış olmalı
-- (kullanicilar.davet_kodu, davetler tablosu vb. zaten var olmalı).
-- supabase/schema.sql'in TAMAMINI ÇALIŞTIRMAYIN — mevcut verinizi siler.
-- ============================================================

-- 1) Yeni hesap_turu enum'u ve kullanicilar sütunu
CREATE TYPE hesap_turu_tipi AS ENUM ('arsa_sahibi', 'muteahhit', 'her_ikisi');

ALTER TABLE public.kullanicilar
  ADD COLUMN IF NOT EXISTS hesap_turu hesap_turu_tipi NOT NULL DEFAULT 'arsa_sahibi';

-- Mevcut kullanıcılar için hesap_turu'yu eski "rol" alanından türet.
UPDATE public.kullanicilar SET hesap_turu = 'muteahhit' WHERE rol = 'muteahhit';

-- 2) handle_new_user(): hesap_turu metadata'dan okunur ve kaydedilir
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_davet_eden_id uuid;
  v_hesap_turu    hesap_turu_tipi;
BEGIN
  v_hesap_turu := CASE NEW.raw_user_meta_data->>'hesap_turu'
    WHEN 'muteahhit' THEN 'muteahhit'::hesap_turu_tipi
    WHEN 'her_ikisi' THEN 'her_ikisi'::hesap_turu_tipi
    ELSE 'arsa_sahibi'::hesap_turu_tipi
  END;

  SELECT id INTO v_davet_eden_id
  FROM public.kullanicilar
  WHERE davet_kodu = NEW.raw_user_meta_data->>'davet_referans_kodu';

  INSERT INTO public.kullanicilar (id, email, ad_soyad, davet_kodu, davet_eden_id, hesap_turu)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'ad_soyad', split_part(NEW.email, '@', 1)),
    public.gen_davet_kodu(),
    v_davet_eden_id,
    v_hesap_turu
  );

  IF v_davet_eden_id IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.davet_odulunu_baslat(v_davet_eden_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- 3) davet_odulunu_baslat(): ödül türünü davet edenin hesap_turu'suna göre otomatik belirler
CREATE OR REPLACE FUNCTION public.davet_odulunu_baslat(p_eden_id uuid, p_edilen_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hesap_turu  hesap_turu_tipi;
  v_ihale_id    uuid;
  v_aktif_sayi  integer;
BEGIN
  SELECT hesap_turu INTO v_hesap_turu FROM public.kullanicilar WHERE id = p_eden_id;

  IF v_hesap_turu = 'muteahhit' THEN
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

  ELSE -- her_ikisi
    INSERT INTO public.davetler (davet_eden_id, davet_edilen_id)
    VALUES (p_eden_id, p_edilen_id)
    ON CONFLICT (davet_edilen_id) DO NOTHING;
  END IF;
END;
$$;

-- 4) handle_davet_odul_kaydi(): artık davet_odulunu_baslat()'a devrediyor
CREATE OR REPLACE FUNCTION public.handle_davet_odul_kaydi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_eden_id uuid;
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    SELECT davet_eden_id INTO v_eden_id FROM public.kullanicilar WHERE id = NEW.id;
    IF v_eden_id IS NOT NULL THEN
      PERFORM public.davet_odulunu_baslat(v_eden_id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) davet_odulu_uygula(): önceden belirlenmiş odul_turu varsa istemci değerini yok sayar
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
    RAISE EXCEPTION 'Davet bulunamadı';
  END IF;

  IF v_davet.davet_eden_id <> auth.uid() THEN
    RAISE EXCEPTION 'Bu davet size ait değil';
  END IF;

  IF v_davet.odul_verildi THEN
    RAISE EXCEPTION 'Bu davet için ödül zaten verildi';
  END IF;

  v_odul_turu := COALESCE(v_davet.odul_turu, p_odul_turu);

  IF v_odul_turu = 'teklif_hakki' THEN
    UPDATE public.kullanicilar
    SET kalan_teklif_hakki = CASE
      WHEN kalan_teklif_hakki >= 99999 THEN kalan_teklif_hakki
      ELSE kalan_teklif_hakki + 1
    END
    WHERE id = auth.uid();

  ELSIF v_odul_turu = 'sure_uzatma' THEN
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
      odul_turu            = v_odul_turu,
      uygulanan_ihale_id   = p_ihale_id,
      odul_verildi_tarihi  = now()
  WHERE id = p_davet_id;
END;
$$;

-- 6) oauth_kayit_tamamla(): Google/Apple ile kayıtta hesap_turu ve davet
-- kodu bağlantısını /auth/callback'ten tamamlar (signInWithOAuth signUp
-- gibi custom metadata taşıyamadığı için).
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
        UPDATE public.kullanicilar SET davet_eden_id = v_eden_id WHERE id = auth.uid();

        IF (SELECT email_confirmed_at FROM auth.users WHERE id = auth.uid()) IS NOT NULL THEN
          PERFORM public.davet_odulunu_baslat(v_eden_id, auth.uid());
        END IF;
      END IF;
    END IF;
  END IF;
END;
$$;
