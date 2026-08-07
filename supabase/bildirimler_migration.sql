-- Bildirim sistemi: bildirimler tablosu + RLS politikalari + gercek
-- olaylara (yeni teklif, ihale onay/red, otomatik sonlandirma, davet
-- odulu, odeme sorunu) bagli tetikleyiciler.
-- Idempotent, tek "Run" ile guvenle calisir.
-- Not: bu migration SADECE veritabani tarafidir; bildirimleri
-- goruntuleyecek arayuz (zil ikonu / bildirim listesi) kapsam disidir.

CREATE TABLE IF NOT EXISTS public.bildirimler (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kullanici_id uuid        NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  tur          text        NOT NULL CHECK (tur IN (
                  'yeni_teklif', 'ihale_onaylandi', 'ihale_reddedildi',
                  'ihale_otomatik_sonlandi', 'davet_odulu', 'odeme_sorunu'
                )),
  baslik       text        NOT NULL,
  mesaj        text        NOT NULL,
  link         text,
  ihale_id     uuid        REFERENCES public.ihaleler(id) ON DELETE CASCADE,
  okundu       boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bildirimler_kullanici ON public.bildirimler(kullanici_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bildirimler_okunmamis ON public.bildirimler(kullanici_id) WHERE okundu = false;

ALTER TABLE public.bildirimler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kullanici kendi bildirimlerini gorebilir" ON public.bildirimler;
CREATE POLICY "Kullanici kendi bildirimlerini gorebilir"
  ON public.bildirimler FOR SELECT USING (auth.uid() = kullanici_id);

-- INSERT icin kasitli olarak hicbir politika yok: bildirimler sadece
-- asagidaki SECURITY DEFINER trigger fonksiyonlariyla (RLS'i atlayarak)
-- olusturulur, istemci dogrudan sahte bildirim ekleyemez.

DROP POLICY IF EXISTS "Kullanici kendi bildirimini guncelleyebilir" ON public.bildirimler;
CREATE POLICY "Kullanici kendi bildirimini guncelleyebilir"
  ON public.bildirimler FOR UPDATE USING (auth.uid() = kullanici_id);

-- USING (auth.uid() = kullanici_id) yalnizca satir sahipligini dogrular;
-- kullanicinin sadece "okundu" alanini degistirebilmesi (baslik/mesaj/
-- tur alanlarini kendi uydurmasini engellemek) icin trigger'la
-- kisitlaniyor.
CREATE OR REPLACE FUNCTION public.bildirim_kisitli_sutun_kontrol()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tur IS DISTINCT FROM OLD.tur
     OR NEW.baslik IS DISTINCT FROM OLD.baslik
     OR NEW.mesaj IS DISTINCT FROM OLD.mesaj
     OR NEW.link IS DISTINCT FROM OLD.link
     OR NEW.ihale_id IS DISTINCT FROM OLD.ihale_id
     OR NEW.kullanici_id IS DISTINCT FROM OLD.kullanici_id
  THEN
    RAISE EXCEPTION 'KISITLI_ALAN_DEGISTIRILEMEZ: Yalnizca okundu alani degistirilebilir.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bildirim_kisitli_sutun_kontrol ON public.bildirimler;
CREATE TRIGGER trg_bildirim_kisitli_sutun_kontrol
  BEFORE UPDATE ON public.bildirimler
  FOR EACH ROW EXECUTE FUNCTION public.bildirim_kisitli_sutun_kontrol();

DROP POLICY IF EXISTS "Kullanici kendi bildirimini silebilir" ON public.bildirimler;
CREATE POLICY "Kullanici kendi bildirimini silebilir"
  ON public.bildirimler FOR DELETE USING (auth.uid() = kullanici_id);

-- 1) Yeni teklif verilince ihale sahibine bildirim.
CREATE OR REPLACE FUNCTION public.bildirim_yeni_teklif()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sahip_id     uuid;
  v_ihale_baslik text;
BEGIN
  SELECT olusturan_id, baslik INTO v_sahip_id, v_ihale_baslik
  FROM public.ihaleler WHERE id = NEW.ihale_id;

  IF v_sahip_id IS NOT NULL AND v_sahip_id <> NEW.kullanici_id THEN
    INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, ihale_id, link)
    VALUES (
      v_sahip_id, 'yeni_teklif', 'Yeni teklif alındı',
      COALESCE(v_ihale_baslik, 'İhaleniz') || ' için yeni bir teklif verildi.',
      NEW.ihale_id, '/ihaleler/' || NEW.ihale_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bildirim_yeni_teklif ON public.teklifler;
CREATE TRIGGER trg_bildirim_yeni_teklif
  AFTER INSERT ON public.teklifler
  FOR EACH ROW EXECUTE FUNCTION public.bildirim_yeni_teklif();

-- 2) İhale admin incelemesinden onaylanınca/reddedilince ve otomatik
-- sonlandırılınca ihale sahibine bildirim.
CREATE OR REPLACE FUNCTION public.bildirim_ihale_durumu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.olusturan_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.inceleme_durumu = 'onaylandi' AND OLD.inceleme_durumu IS DISTINCT FROM 'onaylandi' THEN
    INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, ihale_id, link)
    VALUES (
      NEW.olusturan_id, 'ihale_onaylandi', 'İhaleniz onaylandı',
      NEW.baslik || ' ihaleniz mülkiyet incelemesinden onaylandı ve yayında.',
      NEW.id, '/ihaleler/' || NEW.id
    );
  ELSIF NEW.inceleme_durumu = 'reddedildi' AND OLD.inceleme_durumu IS DISTINCT FROM 'reddedildi' THEN
    INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, ihale_id, link)
    VALUES (
      NEW.olusturan_id, 'ihale_reddedildi', 'İhaleniz reddedildi',
      NEW.baslik || ' ihaleniz reddedildi' || COALESCE(': ' || NEW.red_sebebi, '.'),
      NEW.id, '/panel'
    );
  END IF;

  IF NEW.otomatik_sonlandirildi = true AND OLD.otomatik_sonlandirildi IS DISTINCT FROM true THEN
    INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, ihale_id, link)
    VALUES (
      NEW.olusturan_id, 'ihale_otomatik_sonlandi', 'İhaleniz otomatik sonlandırıldı',
      NEW.baslik || ' ihalenizin süresi doldu, 2 gün içinde karar verilmediği için otomatik sonlandırıldı.',
      NEW.id, '/ihaleler/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bildirim_ihale_durumu ON public.ihaleler;
CREATE TRIGGER trg_bildirim_ihale_durumu
  AFTER UPDATE ON public.ihaleler
  FOR EACH ROW EXECUTE FUNCTION public.bildirim_ihale_durumu();

-- 3) Davet ödülü uygulanınca davet edene bildirim.
CREATE OR REPLACE FUNCTION public.bildirim_davet_odulu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.odul_verildi = true AND OLD.odul_verildi IS DISTINCT FROM true THEN
    INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, link)
    VALUES (
      NEW.davet_eden_id, 'davet_odulu', 'Davet ödülünüz uygulandı',
      CASE NEW.odul_turu
        WHEN 'teklif_hakki' THEN 'Davetiniz kabul edildi, +1 teklif hakkı kazandınız.'
        WHEN 'sure_uzatma'  THEN 'Davetiniz kabul edildi, bir ihalenizin süresi 15 gün uzatıldı.'
        ELSE 'Davet ödülünüz hesabınıza tanımlandı.'
      END,
      '/panel'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bildirim_davet_odulu ON public.davetler;
CREATE TRIGGER trg_bildirim_davet_odulu
  AFTER INSERT OR UPDATE ON public.davetler
  FOR EACH ROW EXECUTE FUNCTION public.bildirim_davet_odulu();

-- 4) Ödeme sonrası kredi/plan güncellemesi başarısız olursa (mutabakat
-- hatası) kullaniciya bildirim.
CREATE OR REPLACE FUNCTION public.bildirim_odeme_sorunu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.durum = 'db_guncelleme_hatasi' THEN
    INSERT INTO public.bildirimler (kullanici_id, tur, baslik, mesaj, link)
    VALUES (
      NEW.kullanici_id, 'odeme_sorunu', 'Ödemenizde bir sorun oluştu',
      'Ödemeniz alındı ancak hesabınıza yansıtılırken bir hata oluştu. Lütfen destek ile iletişime geçin.',
      '/panel'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bildirim_odeme_sorunu ON public.odeme_kayitlari;
CREATE TRIGGER trg_bildirim_odeme_sorunu
  AFTER INSERT ON public.odeme_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.bildirim_odeme_sorunu();

-- DOGRULAMA
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bildirimler';
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bildirimler';
SELECT tgname FROM pg_trigger WHERE tgname IN (
  'trg_bildirim_kisitli_sutun_kontrol', 'trg_bildirim_yeni_teklif',
  'trg_bildirim_ihale_durumu', 'trg_bildirim_davet_odulu', 'trg_bildirim_odeme_sorunu'
);
