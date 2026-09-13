-- ============================================================
-- GEÇİCİ TEŞHİS — yeni kullanıcı kaydının "Database error creating
-- new user" ile başarısız olmasının GERÇEK sebebini bulmak için.
-- handle_new_user() içindeki hatayı yutmadan, sadece bir log
-- tablosuna kaydedip ayrıca tekrar fırlatır (mevcut davranış değişmez,
-- sadece görünür hale gelir).
--
-- Bu dosyayı çalıştırdıktan sonra bir kayıt denemesi (signup) daha
-- yapılacak, sonra public._debug_hnu_log tablosu okunacak. İşimiz
-- bitince bu tabloyu ve bu teşhis sarmalayıcısını kaldıracağız.
-- ============================================================

CREATE TABLE IF NOT EXISTS public._debug_hnu_log (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  yeni_id     uuid,
  errmsg      text,
  errstate    text,
  errdetail   text,
  errcontext  text
);

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

  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._debug_hnu_log (yeni_id, errmsg, errstate, errdetail, errcontext)
    VALUES (NEW.id, SQLERRM, SQLSTATE, PG_EXCEPTION_DETAIL, PG_EXCEPTION_CONTEXT);
    RAISE;
  END;

  RETURN NEW;
END;
$$;
