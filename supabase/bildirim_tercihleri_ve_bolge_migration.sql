-- Bildirim tercihleri (ayarlar sayfasi icin) + bolge eslesmesi bildirimi
-- (muteahhitlere calistigi il'de yeni onayli ihale acilinca bildirim).
-- Idempotent, tek "Run" ile guvenle calisir.
-- Not: E-posta gonderimi bu turda KAPSAM DISI birakildi (sadece
-- uygulama-ici bildirim) -- Resend/SendGrid gibi bir servis eklendiginde
-- ayri bir migration ile genisletilebilir.

-- ------------------------------------------------------------
-- 1) bildirim_tercihleri tablosu
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bildirim_tercihleri (
  kullanici_id    uuid        PRIMARY KEY REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  yeni_teklif     boolean     NOT NULL DEFAULT true,
  ihale_durumu    boolean     NOT NULL DEFAULT true,
  davet_odulu     boolean     NOT NULL DEFAULT true,
  odeme_sorunu    boolean     NOT NULL DEFAULT true,
  bolge_eslesmesi boolean     NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bildirim_tercihleri ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kullanici kendi tercihlerini gorebilir" ON public.bildirim_tercihleri;
CREATE POLICY "Kullanici kendi tercihlerini gorebilir"
  ON public.bildirim_tercihleri FOR SELECT USING (auth.uid() = kullanici_id);

DROP POLICY IF EXISTS "Kullanici kendi tercihlerini olusturabilir" ON public.bildirim_tercihleri;
CREATE POLICY "Kullanici kendi tercihlerini olusturabilir"
  ON public.bildirim_tercihleri FOR INSERT WITH CHECK (auth.uid() = kullanici_id);

DROP POLICY IF EXISTS "Kullanici kendi tercihlerini guncelleyebilir" ON public.bildirim_tercihleri;
CREATE POLICY "Kullanici kendi tercihlerini guncelleyebilir"
  ON public.bildirim_tercihleri FOR UPDATE USING (auth.uid() = kullanici_id) WITH CHECK (auth.uid() = kullanici_id);

DROP TRIGGER IF EXISTS trg_bildirim_tercihleri_updated_at ON public.bildirim_tercihleri;
CREATE TRIGGER trg_bildirim_tercihleri_updated_at
  BEFORE UPDATE ON public.bildirim_tercihleri
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Mevcut kullanicilar icin bir kerelik backfill.
INSERT INTO public.bildirim_tercihleri (kullanici_id)
SELECT id FROM public.kullanicilar
ON CONFLICT (kullanici_id) DO NOTHING;

-- Yeni kayitta otomatik varsayilan tercih satiri olustur.
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
    COALESCE(NEW.raw_user_meta_data->>'ad_soyad', split_part(NEW.email, '@', 1)),
    public.gen_davet_kodu(),
    v_davet_eden_id,
    v_hesap_turu
  );

  INSERT INTO public.bildirim_tercihleri (kullanici_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  IF v_davet_eden_id IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.davet_odulunu_baslat(v_davet_eden_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 2) Mevcut bildirim tetikleyicilerini tercihleri kontrol edecek
-- sekilde guncelle.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bildirim_yeni_teklif()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sahip_id     uuid;
  v_ihale_baslik text;
BEGIN
  SELECT olusturan_id, baslik INTO v_sahip_id, v_ihale_baslik
  FROM public.ihaleler WHERE id = NEW.ihale_id;

  IF v_sahip_id IS NOT NULL AND v_sahip_id <> NEW.kullanici_id
     AND COALESCE((SELECT yeni_teklif FROM public.bildirim_tercihleri WHERE kullanici_id = v_sahip_id), true)
  THEN
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

CREATE OR REPLACE FUNCTION public.bildirim_ihale_durumu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.olusturan_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT COALESCE((SELECT ihale_durumu FROM public.bildirim_tercihleri WHERE kullanici_id = NEW.olusturan_id), true) THEN
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

CREATE OR REPLACE FUNCTION public.bildirim_davet_odulu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.odul_verildi = true AND OLD.odul_verildi IS DISTINCT FROM true
     AND COALESCE((SELECT davet_odulu FROM public.bildirim_tercihleri WHERE kullanici_id = NEW.davet_eden_id), true)
  THEN
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

CREATE OR REPLACE FUNCTION public.bildirim_odeme_sorunu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.durum = 'db_guncelleme_hatasi'
     AND COALESCE((SELECT odeme_sorunu FROM public.bildirim_tercihleri WHERE kullanici_id = NEW.kullanici_id), true)
  THEN
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

-- ------------------------------------------------------------
-- 3) Bolge eslesmesi bildirimi: ihale onaylanip yayina girince,
-- calistigi_iller listesinde o il gecen muteahhitlere bildirim.
-- ------------------------------------------------------------

ALTER TABLE public.bildirimler DROP CONSTRAINT IF EXISTS bildirimler_tur_check;
ALTER TABLE public.bildirimler ADD CONSTRAINT bildirimler_tur_check CHECK (tur IN (
  'yeni_teklif', 'ihale_onaylandi', 'ihale_reddedildi', 'ihale_otomatik_sonlandi',
  'davet_odulu', 'odeme_sorunu', 'bolge_eslesmesi'
));

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
      IF COALESCE((SELECT bolge_eslesmesi FROM public.bildirim_tercihleri WHERE kullanici_id = v_muteahhit.kullanici_id), true) THEN
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

-- ------------------------------------------------------------
-- 4) Realtime: bildirimler tablosunu yayina ekle (Navbar zil ikonu
-- canli guncellensin diye). Zaten ekliyse atlar.
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bildirimler'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bildirimler;
  END IF;
END $$;

-- DOGRULAMA
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bildirim_tercihleri';
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_bolge_eslesmesi_bildir';
SELECT conname FROM pg_constraint WHERE conname = 'bildirimler_tur_check';
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bildirimler';
