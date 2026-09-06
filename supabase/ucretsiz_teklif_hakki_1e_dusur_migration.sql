-- ============================================================
-- İhaleTR — Ücretsiz teklif hakkını 2'den 1'e düşür
-- Supabase Dashboard > SQL Editor > New Query'e yapıştırıp çalıştırın.
-- (Idempotent: birden fazla kez çalıştırılabilir. Mevcut kullanıcıların
--  kalan_teklif_hakki değerine DOKUNMAZ — yalnızca yeni kayıtları etkiler.)
-- ============================================================

-- 1) Kolon varsayılanı: yalnızca BUNDAN SONRA açılacak hesaplar için.
ALTER TABLE public.kullanicilar
  ALTER COLUMN kalan_teklif_hakki SET DEFAULT 1;

-- 2) handle_new_user(): yeni kullanıcıya tanınan teklif hakkını, kolon
-- varsayılanına dolaylı olarak güvenmek yerine INSERT içinde açıkça 1
-- olarak belirtir (fonksiyonun kendi başına tutarlı olması için).
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

  INSERT INTO public.kullanicilar
    (id, email, ad_soyad, davet_kodu, davet_eden_id, hesap_turu, kalan_teklif_hakki)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'ad_soyad', split_part(NEW.email, '@', 1)),
    public.gen_davet_kodu(),
    v_davet_eden_id,
    v_hesap_turu,
    1
  );

  INSERT INTO public.bildirim_tercihleri (kullanici_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  IF v_davet_eden_id IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.davet_odulunu_baslat(v_davet_eden_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- DOGRULAMA
SELECT column_default FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'kullanicilar' AND column_name = 'kalan_teklif_hakki';
SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';
