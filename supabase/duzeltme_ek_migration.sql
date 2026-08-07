-- Onceki (ultra_guvenlik_denetimi_migration.sql) migration'daki 2 madde
-- canli testte calismadi tespit edildi: kullanicilar_ozet view'i bos
-- donuyordu, ve teklif eklendiginde/silindiginde mevcut_teklif ile
-- ihale olusturma hiz siniri calismiyordu. Bu kucuk ek migration
-- SADECE bu 3 seyi tekrar (idempotent, guvenli) uygular.
-- Onceki migration'i tekrar calistirmaya GEREK YOK, sadece bunu calistirin.

-- 1) DUZELTME: security_invoker=true YANLIS secimdi -- cagiran rolun
-- (anon/authenticated) kullanicilar tablosundaki kisitlayici RLS'ini
-- view'e de uyguluyor, view'i herkes icin BOS donduruyordu.
-- security_invoker=false (varsayilan): view, olusturan rolun (tablo
-- sahibi) yetkisiyle calisir, boylece kisitlayici RLS'i "atlar" --
-- view'in SELECT listesi zaten sadece herkese acik alanlarla sinirli
-- oldugu icin bu guvenli.
CREATE OR REPLACE VIEW public.kullanicilar_ozet AS
SELECT id, ad_soyad, firma_adi, hesap_turu, avatar_url
FROM public.kullanicilar;

GRANT SELECT ON public.kullanicilar_ozet TO anon, authenticated;

-- 2) Teklif eklenince/silininde mevcut_teklif guncellemesi (tekrar,
-- guvenceye almak icin).
CREATE OR REPLACE FUNCTION public.guncelle_mevcut_teklif()
RETURNS trigger LANGUAGE plpgsql AS $$
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

-- 3) Ihale olusturma hiz siniri (tekrar, guvenceye almak icin).
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

-- DOGRULAMA (bu 4 satirin hepsi sonuc donmeli)
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'on_teklif_degisti';
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_ihale_olusturma_hiz_siniri';
SELECT proname FROM pg_proc WHERE proname IN ('guncelle_mevcut_teklif', 'ihale_olusturma_hiz_siniri');
SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'kullanicilar_ozet';
