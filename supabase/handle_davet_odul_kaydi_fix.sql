-- ============================================================
-- İhaleTR — Google OAuth girişinde "Database error saving new user"
-- hatasının GERÇEK kök nedeninin düzeltmesi.
-- Bu dosyayı Supabase Dashboard > SQL Editor'e yapıştırıp çalıştırın.
-- ============================================================
--
-- Teşhis (Postgres/Auth loglarından doğrulandı):
-- auth.users üzerindeki on_auth_user_email_confirmed (AFTER UPDATE)
-- tetikleyicisi handle_davet_odul_kaydi()'yi çağırıyor. Bu fonksiyonun
-- kendi EXCEPTION bloğu yoktu — sadece INSERT tetikleyicisi olan
-- handle_new_user() güvenceye alınmıştı (bkz. google_oauth_fix.sql).
--
-- handle_davet_odul_kaydi() kendisi OAuth'a özgü eksik bir alana
-- erişmiyor (yalnızca NEW.id ve OLD/NEW.email_confirmed_at kullanıyor,
-- ikisi de her sağlayıcıda var). Ancak çağırdığı davet_odulunu_baslat()
-- fonksiyonu public.davetler'e INSERT yapıyor ve davetler.davet_edilen_id
-- sütunu public.kullanicilar(id)'e FOREIGN KEY. Google ile ilk kayıtta
-- (özellikle e-posta çakışması gibi bir nedenle) kullanicilar satırı
-- henüz yoksa bu INSERT bir foreign key ihlaliyle patlıyor ve bu hata
-- hiçbir yerde yakalanmadığı için auth.users UPDATE'ini bloke edip
-- GoTrue'nun genel "Database error saving new user" mesajına dönüşüyor.
--
-- Düzeltme: handle_new_user()'da olduğu gibi, bu fonksiyonu da
-- EXCEPTION WHEN OTHERS ile sarıyoruz — davet ödülü işlenirken çıkan
-- hiçbir hata artık auth.users güncellemesini/girişini bloke etmeyecek,
-- yalnızca uyarı olarak loglanacak.

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
EXCEPTION
  WHEN OTHERS THEN
    -- Davet ödülü işlenirken çıkan hiçbir hata auth.users
    -- güncellemesini/girişini asla engellemesin; sorunu logda uyarı
    -- olarak bırak.
    RAISE WARNING 'handle_davet_odul_kaydi basarisiz (auth.users id=%): %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
