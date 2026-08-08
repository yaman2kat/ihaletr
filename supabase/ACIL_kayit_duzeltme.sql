-- ACIL: yeni kullanici kaydi (auth.users trigger'i) su an hata veriyor
-- gibi gorunuyor -- muhtemelen onceki migration'daki handle_new_user()
-- guncellemesi kopyalama sirasinda bozulmus olabilir. Bu dosya
-- handle_new_user()'i temiz haliyle YENIDEN gonderir (idempotent,
-- guvenle tekrar calisir).

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

  INSERT INTO public.bildirim_tercihleri (kullanici_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  IF v_davet_eden_id IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.davet_odulunu_baslat(v_davet_eden_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- DOGRULAMA: bu fonksiyonun kaynagini gosterir, gozle kontrol edin --
-- "bildirim_tercihleri" satiri olmali ve $$ ile duzgun kapanmali.
SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);
