-- 1) kullanicilar tablosuna e-posta bildirim tercihi sutunlari ekler
-- (gercek e-posta gonderimi kapsam disi -- bu sutunlar sadece
-- kullanicinin tercihini saklar, ileride Resend/SendGrid eklendiginde
-- gate olarak kullanilacak).
-- 2) bolge eslesmesi bildirimine ekstra mukerrer-onleme korumasi ekler.
-- Idempotent, tek "Run" ile guvenle calisir.

ALTER TABLE public.kullanicilar
  ADD COLUMN IF NOT EXISTS email_yeni_teklif      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_ihale_durumu     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_davet_odulu      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_odeme_sorunu     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_bolge_eslesmesi  boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.bolge_eslesmesi_bildir()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_muteahhit RECORD;
BEGIN
  IF NEW.inceleme_durumu = 'onaylandi' AND OLD.inceleme_durumu IS DISTINCT FROM 'onaylandi' THEN
    FOR v_muteahhit IN
      SELECT mp.kullanici_id
      FROM public.muteahhit_profiller mp
      WHERE NEW.sehir = ANY(mp.calistigi_iller)
        AND mp.kullanici_id IS DISTINCT FROM NEW.olusturan_id
    LOOP
      IF COALESCE((SELECT bolge_eslesmesi FROM public.bildirim_tercihleri WHERE kullanici_id = v_muteahhit.kullanici_id), true)
         AND NOT EXISTS (
           SELECT 1 FROM public.bildirimler
           WHERE kullanici_id = v_muteahhit.kullanici_id
             AND ihale_id = NEW.id
             AND tur = 'bolge_eslesmesi'
         )
      THEN
        INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, ihale_id, link)
        VALUES (
          v_muteahhit.kullanici_id, 'bolge_eslesmesi', 'Bölgenizde yeni bir ihale var',
          NEW.sehir || COALESCE(' / ' || NEW.ilce, '') || ' bölgesinde "' || NEW.baslik || '" başlıklı yeni bir ihale yayınlandı.',
          NEW.id, '/ihaleler/' || NEW.id
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bolge_eslesmesi_bildir ON public.ihaleler;
CREATE TRIGGER trg_bolge_eslesmesi_bildir
  AFTER UPDATE ON public.ihaleler
  FOR EACH ROW EXECUTE FUNCTION public.bolge_eslesmesi_bildir();

-- DOGRULAMA
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'kullanicilar' AND column_name LIKE 'email_%';
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_bolge_eslesmesi_bildir';
