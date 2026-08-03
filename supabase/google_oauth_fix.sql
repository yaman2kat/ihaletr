-- ============================================================
-- İhaleTR — Google OAuth ile kayıtta "Database error saving new
-- user" hatasının düzeltmesi.
-- Bu dosyayı Supabase Dashboard > SQL Editor'e yapıştırıp çalıştırın.
-- ÖNKOŞUL: supabase/hesap_turu_migration.sql daha önce uygulanmış
-- olmalı (hesap_turu_tipi, gen_davet_kodu(), davet_odulunu_baslat()
-- zaten var olmalı).
-- ============================================================
--
-- Kök neden analizi:
-- 1) hesap_turu sütunu zaten NOT NULL DEFAULT 'arsa_sahibi' ve
--    handle_new_user() metadata'da hesap_turu yoksa/geçersizse zaten
--    'arsa_sahibi'ye düşüyordu — bu yönüyle fonksiyon zaten güvenliydi.
-- 2) Asıl kırılma noktası: public.kullanicilar.email UNIQUE. Bir
--    kullanıcı önce e-posta/şifre ile kayıt olup sonra AYNI e-posta
--    ile Google'a giriş yaparsa, Supabase auth.users'da YENİ bir id
--    ile ikinci bir satır oluşturur; handle_new_user bu yeni id için
--    kullanicilar'a INSERT denediğinde email UNIQUE ihlali oluşur,
--    tetikleyici hata fırlatır ve GoTrue bunu genel "Database error
--    saving new user" mesajıyla döndürür.
-- 3) Google'ın metadata'sında "ad_soyad" alanı yoktur (full_name/name
--    gelir) — eski kod bunu split_part(email) ile telafi ediyordu,
--    ama Google'ın gerçek adını hiç kullanmıyordu.
--
-- Bu düzeltme: e-posta çakışmasında INSERT'i sessizce atlar (mevcut
-- profil korunur, oturum açma engellenmez), Google'ın full_name/name
-- alanlarını da isim kaynağı olarak dener ve beklenmedik her hatada
-- kaydı uyarıya çevirip auth akışını yine de tamamlar.

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
    COALESCE(
      NEW.raw_user_meta_data->>'ad_soyad',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    public.gen_davet_kodu(),
    v_davet_eden_id,
    v_hesap_turu
  )
  ON CONFLICT (email) DO NOTHING;

  -- Satır gerçekten eklendiyse (email çakışması yoksa) davet ödülünü işlet.
  IF FOUND AND v_davet_eden_id IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.davet_odulunu_baslat(v_davet_eden_id, NEW.id);
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Profil oluşturmadaki beklenmedik bir hata auth kaydını asla
    -- engellemesin; sorunu logda uyarı olarak bırak.
    RAISE WARNING 'handle_new_user basarisiz (auth.users id=%): %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
