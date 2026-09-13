-- ============================================================
-- KRİTİK DÜZELTME — yeni kullanıcı kaydı "Database error creating
-- new user" ile başarısız oluyordu.
--
-- Kök sebep: plan_ve_davet_yeniden_yapilandirma_migration.sql,
-- handle_new_user() fonksiyonunu yeniden tanımlarken (davet_eden_id
-- mantığını kaldırırken) "SET search_path = public" ifadesini
-- kaybetti. Bu fonksiyon auth.users üzerinde AFTER INSERT trigger'ı
-- olarak supabase_auth_admin rolüyle çalışır; bu rolün search_path'i
-- "public" şemasını içermez. Fonksiyon gövdesinde şema öneki
-- OLMADAN kullanılan "hesap_turu_tipi" enum tipi bu yüzden
-- çözümlenemiyor ve her yeni kayıtta hata fırlatıyordu (search_path_fix.sql
-- dosyası bu projede tam olarak bu sorunu daha önce bir kez çözmüştü,
-- ama schema.sql'e hiç yansıtılmamıştı).
--
-- Bu dosya: (1) handle_new_user()'ı SET search_path = public ile
-- doğru şekilde yeniden tanımlar (mantık plan_ve_davet migration'ıyla
-- aynı, yalnızca search_path eklendi), (2) aynı güvenlik için
-- oauth_kayit_tamamla()'ya da search_path ekler, (3) geçici teşhis
-- sarmalayıcısını ve log tablosunu temizler.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.oauth_kayit_tamamla(
  p_hesap_turu hesap_turu_tipi DEFAULT NULL,
  p_ref_kodu   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_hesap_turu IS NOT NULL THEN
    UPDATE public.kullanicilar SET hesap_turu = p_hesap_turu WHERE id = auth.uid();
  END IF;
END;
$$;

-- Gecici teshis kalintilarini temizle
DROP TABLE IF EXISTS public._debug_hnu_log;

-- DOGRULAMA: search_path artik dogru ayarlanmis mi?
SELECT p.proname, p.prosecdef AS security_definer, p.proconfig AS config
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('handle_new_user', 'oauth_kayit_tamamla');
