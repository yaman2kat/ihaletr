-- Kapsamli guvenlik denetiminde bulunan 2 DB-seviyesi acigin duzeltmesi.
-- Idempotent, tek "Run" ile guvenle calisir.
-- (api/odeme/route.ts'deki oturum dogrulama eksikligi sadece uygulama
-- kodunda duzeltildi, DB migration gerektirmiyor.)

-- ------------------------------------------------------------
-- 1) Ihale sahibi, dogrudan PATCH ile kendi ihalesinin inceleme_durumu'nu
-- "onaylandi" yaparak admin mulkiyet incelemesini bypass edebiliyordu
-- (RLS satir bazlidir, sutun kisitlamaz). Bu trigger admin/sistem disinda
-- inceleme_durumu, red_sebebi, otomatik_sonlandirildi alanlarinin
-- dogrudan degistirilmesini engeller.
-- (Onceki surumde mevcut_teklif/goruntulenme_sayisi de kisitlanmaya
-- calisildi ama pg_trigger_depth() tabanli ayrim, teklif eklenince
-- calisan guncelle_mevcut_teklif() trigger'ini bozdugu icin (regresyon
-- testiyle tespit edildi) bu ikisi kapsam disi birakildi.)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ihale_kisitli_sutun_kontrol()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  admin_mi boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (rol = 'admin') INTO admin_mi FROM public.kullanicilar WHERE id = auth.uid();
  IF admin_mi THEN
    RETURN NEW;
  END IF;

  IF NEW.inceleme_durumu IS DISTINCT FROM OLD.inceleme_durumu
     OR NEW.red_sebebi IS DISTINCT FROM OLD.red_sebebi
     OR NEW.otomatik_sonlandirildi IS DISTINCT FROM OLD.otomatik_sonlandirildi
  THEN
    RAISE EXCEPTION 'KISITLI_ALAN_DEGISTIRILEMEZ: Bu alanlar yalnizca admin/sistem tarafindan degistirilebilir.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ihale_kisitli_sutun_kontrol ON public.ihaleler;
CREATE TRIGGER trg_ihale_kisitli_sutun_kontrol
  BEFORE UPDATE ON public.ihaleler
  FOR EACH ROW EXECUTE FUNCTION public.ihale_kisitli_sutun_kontrol();

-- ------------------------------------------------------------
-- 2) danishmanlar tablosunda INSERT/UPDATE/DELETE politikalari
-- "auth.uid() IS NOT NULL" kontroluyle HERHANGI bir giris yapmis
-- kullaniciya acikti (yorum "yalnizca admin" diyordu ama kod izin
-- vermiyordu). Admin kontrolu eklendi.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Giris yapan kullanici danishman ekleyebilir" ON public.danishmanlar;
DROP POLICY IF EXISTS "Sadece admin danisman ekleyebilir" ON public.danishmanlar;
CREATE POLICY "Sadece admin danisman ekleyebilir"
  ON public.danishmanlar FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

DROP POLICY IF EXISTS "Giris yapan kullanici danishman guncelleyebilir" ON public.danishmanlar;
DROP POLICY IF EXISTS "Sadece admin danisman guncelleyebilir" ON public.danishmanlar;
CREATE POLICY "Sadece admin danisman guncelleyebilir"
  ON public.danishmanlar FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

DROP POLICY IF EXISTS "Giris yapan kullanici danishman silebilir" ON public.danishmanlar;
DROP POLICY IF EXISTS "Sadece admin danisman silebilir" ON public.danishmanlar;
CREATE POLICY "Sadece admin danisman silebilir"
  ON public.danishmanlar FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

-- DOGRULAMA
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_ihale_kisitli_sutun_kontrol';
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'danishmanlar';
