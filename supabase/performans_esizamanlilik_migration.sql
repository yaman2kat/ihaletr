-- Performans + eszamanlilik denetiminde bulunan 3 DB-seviyesi sorunun
-- duzeltmesi. Idempotent, tek "Run" ile guvenle calisir.
-- (Sayfalama ve dosya boyutu limiti sadece uygulama kodunda; DB migration
-- gerektirmiyor.)

-- ------------------------------------------------------------
-- 1) Odeme sonrasi kalan_teklif_hakki artisi: oku-hesapla-yaz yerine
-- tek atomik UPDATE. Eszamanli iki odeme tamamlanmasi (webhook tekrari,
-- cift tiklama vb.) artik birbirinin yazdigini ezemez.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.artir_teklif_hakki(p_kullanici_id uuid, p_miktar integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yeni_hak integer;
BEGIN
  UPDATE public.kullanicilar
  SET kalan_teklif_hakki = kalan_teklif_hakki + p_miktar
  WHERE id = p_kullanici_id
  RETURNING kalan_teklif_hakki INTO yeni_hak;

  RETURN yeni_hak;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.artir_teklif_hakki(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.artir_teklif_hakki(uuid, integer) TO service_role;

-- ------------------------------------------------------------
-- 2) Teklif hakki kontrolunu DB seviyesine tasi: hakki bitmis (<=0)
-- bir kullanici INSERT denese bile (istemci kontrolunu bypass etse
-- bile) reddedilsin.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.teklif_hakki_kontrol()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  mevcut_hak integer;
BEGIN
  SELECT kalan_teklif_hakki INTO mevcut_hak
  FROM public.kullanicilar
  WHERE id = NEW.kullanici_id;

  IF mevcut_hak IS NULL OR mevcut_hak <= 0 THEN
    RAISE EXCEPTION 'TEKLIF_HAKKI_YETERSIZ: Teklif hakkiniz kalmadi.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teklif_hakki_kontrol ON public.teklifler;
CREATE TRIGGER trg_teklif_hakki_kontrol
  BEFORE INSERT ON public.teklifler
  FOR EACH ROW EXECUTE FUNCTION public.teklif_hakki_kontrol();

-- ------------------------------------------------------------
-- 3) ihaleler.olusturan_id icin eksik indeks ("benim ihalelerim"
-- panel sorgusu bu sutunda filtreliyor).
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_ihaleler_olusturan ON public.ihaleler(olusturan_id);

-- DOGRULAMA
SELECT proname FROM pg_proc WHERE proname IN ('artir_teklif_hakki', 'teklif_hakki_kontrol');
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_teklif_hakki_kontrol';
SELECT indexname FROM pg_indexes WHERE tablename = 'ihaleler' AND indexname = 'idx_ihaleler_olusturan';
