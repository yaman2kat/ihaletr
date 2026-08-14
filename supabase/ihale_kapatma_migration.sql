-- "Ihaleyi Kapat ve Firma Sec" ozelligi:
-- 1) ihaleler.secilen_firma_id sutunu -- ihale sahibinin sec sonuc
--    raporundan sectigi kazanan firma.
-- 2) Secim yapilinca: kazanan teklif kabul_edildi, digerleri reddedildi;
--    kazanan muteahhitin kazanilan_ihale_sayisi 1 artar; ihale sahibine,
--    kazanan firmaya ve diger teklif verenlere bildirim gider.
-- Idempotent, tek "Run" ile guvenle calisir.

ALTER TABLE public.ihaleler
  ADD COLUMN IF NOT EXISTS secilen_firma_id uuid REFERENCES public.kullanicilar(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ihaleler_secilen_firma ON public.ihaleler(secilen_firma_id);

-- bildirimler.tur CHECK kisitina yeni turler eklenir.
ALTER TABLE public.bildirimler DROP CONSTRAINT IF EXISTS bildirimler_tur_check;
ALTER TABLE public.bildirimler ADD CONSTRAINT bildirimler_tur_check CHECK (tur IN (
  'yeni_teklif', 'ihale_onaylandi', 'ihale_reddedildi', 'ihale_otomatik_sonlandi',
  'davet_odulu', 'odeme_sorunu', 'bolge_eslesmesi',
  'ihale_kapatildi', 'ihale_kazanildi', 'ihale_kaybedildi'
));

CREATE OR REPLACE FUNCTION public.ihale_kapatildi_bildir()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kaybeden RECORD;
BEGIN
  IF NEW.secilen_firma_id IS NULL OR NEW.secilen_firma_id IS NOT DISTINCT FROM OLD.secilen_firma_id THEN
    RETURN NEW;
  END IF;

  -- Kazanan teklifi kabul_edildi, bekleyen digerlerini reddedildi yap.
  UPDATE public.teklifler SET durum = 'kabul_edildi'
    WHERE ihale_id = NEW.id AND kullanici_id = NEW.secilen_firma_id;
  UPDATE public.teklifler SET durum = 'reddedildi'
    WHERE ihale_id = NEW.id AND kullanici_id <> NEW.secilen_firma_id AND durum = 'beklemede';

  -- Kazanan muteahhitin kazanilan ihale sayisini artir (profili varsa).
  UPDATE public.muteahhit_profiller SET kazanilan_ihale_sayisi = kazanilan_ihale_sayisi + 1
    WHERE kullanici_id = NEW.secilen_firma_id;

  IF NEW.olusturan_id IS NOT NULL THEN
    INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, ihale_id, link)
    VALUES (
      NEW.olusturan_id, 'ihale_kapatildi', 'İhaleyi kapattınız',
      NEW.baslik || ' ihalesini kapattınız ve kazanan firmayı seçtiniz.',
      NEW.id, '/ihaleler/' || NEW.id
    );
  END IF;

  INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, ihale_id, link)
  VALUES (
    NEW.secilen_firma_id, 'ihale_kazanildi', 'İhale size verildi 🎉',
    NEW.baslik || ' ihalesi size verildi. Tebrikler!',
    NEW.id, '/ihaleler/' || NEW.id
  );

  FOR v_kaybeden IN
    SELECT DISTINCT kullanici_id FROM public.teklifler
    WHERE ihale_id = NEW.id AND kullanici_id <> NEW.secilen_firma_id
  LOOP
    INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, ihale_id, link)
    VALUES (
      v_kaybeden.kullanici_id, 'ihale_kaybedildi', 'Sonuçlanan bir ihale',
      NEW.baslik || ' ihalesi başka bir firmaya verildi.',
      NEW.id, '/ihaleler/' || NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ihale_kapatildi_bildir ON public.ihaleler;
CREATE TRIGGER trg_ihale_kapatildi_bildir
  AFTER UPDATE ON public.ihaleler
  FOR EACH ROW EXECUTE FUNCTION public.ihale_kapatildi_bildir();

-- DOGRULAMA
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ihaleler' AND column_name = 'secilen_firma_id';
SELECT conname FROM pg_constraint WHERE conname = 'bildirimler_tur_check';
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_ihale_kapatildi_bildir';
