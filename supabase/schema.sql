-- ============================================================
-- İhaleTR — Supabase Schema
-- Supabase Dashboard > SQL Editor > New Query'e yapıştırıp çalıştırın.
-- ============================================================

-- ============================================================
-- RESET — Mevcut tabloları ve enum tiplerini tamamen siler.
-- DİKKAT: Bu blok mevcut TÜM VERİYİ kalıcı ve geri döndürülemez
-- şekilde siler. Sadece sıfırdan kurulum / şemayı tamamen
-- yeniden oluşturmak isterken çalıştırın.
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TABLE IF EXISTS public.muteahhit_yorumlar          CASCADE;
DROP TABLE IF EXISTS public.muteahhit_referans_projeler CASCADE;
DROP TABLE IF EXISTS public.muteahhit_profiller         CASCADE;
DROP TABLE IF EXISTS public.danishman_gorusme_talepleri CASCADE;
DROP TABLE IF EXISTS public.danishman_yorumlar          CASCADE;
DROP TABLE IF EXISTS public.belgeler                    CASCADE;
DROP TABLE IF EXISTS public.teklifler                   CASCADE;
DROP TABLE IF EXISTS public.danishmanlar                CASCADE;
DROP TABLE IF EXISTS public.ihaleler                    CASCADE;
DROP TABLE IF EXISTS public.kullanicilar                CASCADE;

DROP TYPE IF EXISTS kullanici_rol   CASCADE;
DROP TYPE IF EXISTS ihale_durumu    CASCADE;
DROP TYPE IF EXISTS teklif_durumu   CASCADE;
DROP TYPE IF EXISTS belge_turu      CASCADE;
DROP TYPE IF EXISTS gorusme_durumu  CASCADE;

-- ------------------------------------------------------------
-- 0. ENUM TİPLERİ
-- ------------------------------------------------------------

CREATE TYPE kullanici_rol   AS ENUM ('bireysel', 'firma', 'admin');
CREATE TYPE ihale_durumu    AS ENUM ('aktif', 'beklemede', 'tamamlandi', 'iptal');
CREATE TYPE teklif_durumu   AS ENUM ('beklemede', 'kabul_edildi', 'reddedildi');
CREATE TYPE belge_turu      AS ENUM ('ruhsat', 'proje', 'sozlesme', 'denetim_raporu', 'fotograf', 'diger');
CREATE TYPE gorusme_durumu  AS ENUM ('beklemede', 'onaylandi', 'reddedildi', 'tamamlandi');

-- ------------------------------------------------------------
-- 1. KULLANICILAR
-- auth.users'ı genişleten profil tablosu.
-- Tetikleyici ile her yeni kayıtta otomatik satır oluşur.
-- ------------------------------------------------------------

CREATE TABLE public.kullanicilar (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL UNIQUE,
  ad_soyad    text        NOT NULL,
  firma_adi   text,
  telefon     text,
  avatar_url  text,
  rol         kullanici_rol NOT NULL DEFAULT 'bireysel',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kullanicilar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes profilleri okuyabilir"
  ON public.kullanicilar FOR SELECT USING (true);

CREATE POLICY "Kullanici kendi profilini guncelleyebilir"
  ON public.kullanicilar FOR UPDATE USING (auth.uid() = id);

-- Yeni auth kaydında otomatik profil oluştur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.kullanicilar (id, email, ad_soyad)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'ad_soyad', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 2. İHALELER
-- ------------------------------------------------------------

CREATE TABLE public.ihaleler (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  baslik            text          NOT NULL,
  aciklama          text          NOT NULL,
  kategori          text          NOT NULL,
  baslangic_tarihi  date          NOT NULL,
  bitis_tarihi      date          NOT NULL,
  baslangic_fiyati  numeric(15,2) NOT NULL CHECK (baslangic_fiyati > 0),
  mevcut_teklif     numeric(15,2),
  durum             ihale_durumu  NOT NULL DEFAULT 'beklemede',
  kurum             text          NOT NULL,
  sehir             text          NOT NULL,
  ilce              text,
  ada_no            text,
  parsel_no         text,
  olusturan_id      uuid          REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT bitis_baslangictan_sonra CHECK (bitis_tarihi > baslangic_tarihi)
);

CREATE INDEX idx_ihaleler_durum    ON public.ihaleler(durum);
CREATE INDEX idx_ihaleler_kategori ON public.ihaleler(kategori);
CREATE INDEX idx_ihaleler_sehir    ON public.ihaleler(sehir);
CREATE INDEX idx_ihaleler_bitis    ON public.ihaleler(bitis_tarihi);

ALTER TABLE public.ihaleler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes ihaleleri gorebilir"
  ON public.ihaleler FOR SELECT USING (true);

-- GEÇİCİ: Giriş yapmadan da ihale oluşturulabilsin diye misafir kullanıcılara izin verildi.
-- Eski (giriş zorunlu) hali:
-- CREATE POLICY "Giris yapan ihale olusturabilir"
--   ON public.ihaleler FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Giris yapan ya da misafir ihale olusturabilir"
  ON public.ihaleler FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND (olusturan_id IS NULL OR olusturan_id = auth.uid()))
    OR (auth.uid() IS NULL AND olusturan_id IS NULL)
  );

CREATE POLICY "Olusturan ihalesini guncelleyebilir"
  ON public.ihaleler FOR UPDATE USING (auth.uid() = olusturan_id);

CREATE POLICY "Olusturan ihalesini silebilir"
  ON public.ihaleler FOR DELETE USING (auth.uid() = olusturan_id);

-- ------------------------------------------------------------
-- 3. TEKLİFLER
-- ------------------------------------------------------------

CREATE TABLE public.teklifler (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  ihale_id      uuid          NOT NULL REFERENCES public.ihaleler(id) ON DELETE CASCADE,
  -- GEÇİCİ: Misafir teklifleri için NOT NULL kaldırıldı. Eski hali:
  -- kullanici_id  uuid          NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  kullanici_id  uuid          REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  tutar         numeric(15,2) NOT NULL CHECK (tutar > 0),
  aciklama      text,
  durum         teklif_durumu NOT NULL DEFAULT 'beklemede',
  created_at    timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (ihale_id, kullanici_id)  -- bir kullanıcı aynı ihaleyie tek teklif
);

CREATE INDEX idx_teklifler_ihale     ON public.teklifler(ihale_id);
CREATE INDEX idx_teklifler_kullanici ON public.teklifler(kullanici_id);

ALTER TABLE public.teklifler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ihale sahibi ve teklif sahibi teklifleri gorebilir"
  ON public.teklifler FOR SELECT USING (
    auth.uid() = kullanici_id
    OR auth.uid() = (SELECT olusturan_id FROM public.ihaleler WHERE id = ihale_id)
  );

-- GEÇİCİ: Giriş yapmadan da teklif verilebilsin diye misafir kullanıcılara izin verildi.
-- Eski (giriş zorunlu) hali:
-- CREATE POLICY "Giris yapan teklif verebilir"
--   ON public.teklifler FOR INSERT WITH CHECK (
--     auth.uid() = kullanici_id
--     AND auth.uid() != (SELECT olusturan_id FROM public.ihaleler WHERE id = ihale_id)
--   );
CREATE POLICY "Giris yapan ya da misafir teklif verebilir"
  ON public.teklifler FOR INSERT WITH CHECK (
    (
      auth.uid() IS NOT NULL
      AND auth.uid() = kullanici_id
      AND auth.uid() != (SELECT olusturan_id FROM public.ihaleler WHERE id = ihale_id)
    )
    OR (
      auth.uid() IS NULL
      AND kullanici_id IS NULL
    )
  );

CREATE POLICY "Teklif sahibi teklifini silebilir"
  ON public.teklifler FOR DELETE USING (auth.uid() = kullanici_id);

-- Teklif eklenince ihaledeki mevcut_teklif'i otomatik güncelle
CREATE OR REPLACE FUNCTION public.guncelle_mevcut_teklif()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.ihaleler
  SET
    mevcut_teklif = (SELECT MIN(tutar) FROM public.teklifler WHERE ihale_id = NEW.ihale_id),
    updated_at    = now()
  WHERE id = NEW.ihale_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_teklif_degisti
  AFTER INSERT OR UPDATE ON public.teklifler
  FOR EACH ROW EXECUTE FUNCTION public.guncelle_mevcut_teklif();

-- ------------------------------------------------------------
-- 4. DANIŞMANLAR
-- Yalnızca admin tarafından eklenir.
-- ------------------------------------------------------------

CREATE TABLE public.danishmanlar (
  id                  uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_soyad            text      NOT NULL,
  uzmanlik_alanlari   text[]    NOT NULL DEFAULT '{}',
  calistigi_iller     text[]    NOT NULL DEFAULT '{}',
  il                  text,
  ilce                text,
  telefon             text      NOT NULL,
  email               text      NOT NULL UNIQUE,
  deneyim_yili        integer   NOT NULL CHECK (deneyim_yili >= 0),
  biyografi           text      NOT NULL,
  foto_url            text,
  aktif               boolean   NOT NULL DEFAULT true,
  olusturan_admin_id  uuid      REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_danishmanlar_aktif    ON public.danishmanlar(aktif);
CREATE INDEX idx_danishmanlar_uzmanlik ON public.danishmanlar USING GIN (uzmanlik_alanlari);
CREATE INDEX idx_danishmanlar_iller    ON public.danishmanlar USING GIN (calistigi_iller);

ALTER TABLE public.danishmanlar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes aktif danismanlari gorebilir"
  ON public.danishmanlar FOR SELECT USING (aktif = true);

CREATE POLICY "Giris yapan kullanici danishman ekleyebilir"
  ON public.danishmanlar FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Giris yapan kullanici danishman guncelleyebilir"
  ON public.danishmanlar FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Giris yapan kullanici danishman silebilir"
  ON public.danishmanlar FOR DELETE USING (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- 5. BELGELER
-- İhale ya da danışman kaydına bağlı dosyalar.
-- ------------------------------------------------------------

CREATE TABLE public.belgeler (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  baslik        text        NOT NULL,
  dosya_url     text        NOT NULL,
  dosya_tipi    text,
  boyut         bigint,                      -- bayt cinsinden
  tur           belge_turu  NOT NULL DEFAULT 'diger',
  ihale_id      uuid        REFERENCES public.ihaleler(id) ON DELETE CASCADE,
  danishman_id  uuid        REFERENCES public.danishmanlar(id) ON DELETE CASCADE,
  yukleyen_id   uuid        REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT en_az_bir_iliski CHECK (
    ihale_id IS NOT NULL OR danishman_id IS NOT NULL
  )
);

CREATE INDEX idx_belgeler_ihale     ON public.belgeler(ihale_id);
CREATE INDEX idx_belgeler_danishman ON public.belgeler(danishman_id);
CREATE INDEX idx_belgeler_yukleyen  ON public.belgeler(yukleyen_id);

ALTER TABLE public.belgeler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Belgeler herkese acik"
  ON public.belgeler FOR SELECT USING (true);

-- GEÇİCİ: Misafir kullanıcıların da belge yükleyebilmesi için genişletildi. Eski hali:
-- CREATE POLICY "Giris yapan belge yukleyebilir"
--   ON public.belgeler FOR INSERT WITH CHECK (auth.uid() = yukleyen_id);
CREATE POLICY "Giris yapan ya da misafir belge yukleyebilir"
  ON public.belgeler FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = yukleyen_id)
    OR (auth.uid() IS NULL AND yukleyen_id IS NULL)
  );

CREATE POLICY "Yukleyen kendi belgesini silebilir"
  ON public.belgeler FOR DELETE USING (auth.uid() = yukleyen_id);

-- ------------------------------------------------------------
-- 6. DANIŞMAN YORUMLAR
-- Kullanıcılar danışmanları puanlar ve yorum bırakır.
-- ------------------------------------------------------------

CREATE TABLE public.danishman_yorumlar (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  danishman_id  uuid        NOT NULL REFERENCES public.danishmanlar(id) ON DELETE CASCADE,
  kullanici_id  uuid        REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
  kullanici_adi text        NOT NULL,
  puan          smallint    NOT NULL CHECK (puan BETWEEN 1 AND 5),
  yorum_metni   text        NOT NULL CHECK (char_length(yorum_metni) >= 10),
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (danishman_id, kullanici_id)  -- kullanıcı başına bir yorum
);

CREATE INDEX idx_yorumlar_danishman ON public.danishman_yorumlar(danishman_id);
CREATE INDEX idx_yorumlar_kullanici ON public.danishman_yorumlar(kullanici_id);

ALTER TABLE public.danishman_yorumlar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Yorumlar herkese acik"
  ON public.danishman_yorumlar FOR SELECT USING (true);

CREATE POLICY "Giris yapan yorum ekleyebilir"
  ON public.danishman_yorumlar FOR INSERT WITH CHECK (auth.uid() = kullanici_id);

CREATE POLICY "Kullanici kendi yorumunu silebilir"
  ON public.danishman_yorumlar FOR DELETE USING (auth.uid() = kullanici_id);

-- ------------------------------------------------------------
-- 6b. DANIŞMAN GÖRÜŞME TALEPLERİ
-- Kullanıcı "Görüşme Talep Et" butonuna basınca oluşur.
-- ------------------------------------------------------------

CREATE TABLE public.danishman_gorusme_talepleri (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  danishman_id    uuid           NOT NULL REFERENCES public.danishmanlar(id) ON DELETE CASCADE,
  kullanici_id    uuid           NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  insaat_turu     text           NOT NULL,
  il              text           NOT NULL,
  insaat_asamasi  text           NOT NULL,
  mesaj           text,
  durum           gorusme_durumu NOT NULL DEFAULT 'beklemede',
  created_at      timestamptz    NOT NULL DEFAULT now(),
  updated_at      timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX idx_gorusme_danishman ON public.danishman_gorusme_talepleri(danishman_id);
CREATE INDEX idx_gorusme_kullanici ON public.danishman_gorusme_talepleri(kullanici_id);
CREATE INDEX idx_gorusme_durum     ON public.danishman_gorusme_talepleri(durum);

ALTER TABLE public.danishman_gorusme_talepleri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanici kendi taleplerini gorebilir"
  ON public.danishman_gorusme_talepleri FOR SELECT USING (
    auth.uid() = kullanici_id
    OR EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Giris yapan gorusme talep edebilir"
  ON public.danishman_gorusme_talepleri FOR INSERT WITH CHECK (
    auth.uid() = kullanici_id
  );

CREATE POLICY "Admin talep durumunu guncelleyebilir"
  ON public.danishman_gorusme_talepleri FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

-- ------------------------------------------------------------
-- 7. UPDATED_AT OTOMATİK GÜNCELLEME
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kullanicilar_updated_at
  BEFORE UPDATE ON public.kullanicilar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Premium abonelik + teklif hakkı alanları
ALTER TABLE public.kullanicilar
  ADD COLUMN IF NOT EXISTS plan_turu             text    NOT NULL DEFAULT 'ucretsiz'
    CHECK (plan_turu IN ('ucretsiz', 'premium', 'kurumsal')),
  ADD COLUMN IF NOT EXISTS premium_bitis_tarihi  timestamptz,
  ADD COLUMN IF NOT EXISTS kalan_teklif_hakki    integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS toplam_teklif_sayisi  integer NOT NULL DEFAULT 0;

-- Teklif eklenince kalan hakkı azalt ve toplam sayıyı artır
-- 99999+ değer sınırsız paket göstergesidir (Pro)
CREATE OR REPLACE FUNCTION public.guncelle_kullanici_teklif_hakki()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.kullanicilar
  SET
    toplam_teklif_sayisi = toplam_teklif_sayisi + 1,
    kalan_teklif_hakki   = CASE
      WHEN kalan_teklif_hakki >= 99999 THEN kalan_teklif_hakki
      ELSE GREATEST(0, kalan_teklif_hakki - 1)
    END
  WHERE id = NEW.kullanici_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_teklif_eklendi_hak_duslur
  AFTER INSERT ON public.teklifler
  FOR EACH ROW EXECUTE FUNCTION public.guncelle_kullanici_teklif_hakki();

-- ------------------------------------------------------------
-- 8. MÜTEAHHİT PROFİLLER
-- Her müteahhit kullanıcı için bir profil satırı.
-- ------------------------------------------------------------

-- Kullanıcı rolü enum'una yeni değerler ekle
ALTER TYPE kullanici_rol ADD VALUE IF NOT EXISTS 'arsa_sahibi';
ALTER TYPE kullanici_rol ADD VALUE IF NOT EXISTS 'muteahhit';

CREATE TABLE public.muteahhit_profiller (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kullanici_id             uuid        NOT NULL UNIQUE REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  firma_adi                text        NOT NULL,
  kurulus_yili             integer     CHECK (kurulus_yili >= 1950 AND kurulus_yili <= 2100),
  calistigi_iller          text[]      NOT NULL DEFAULT '{}',
  uzmanlik_alanlari        text[]      NOT NULL DEFAULT '{}',
  lisans_no                text,
  sicil_no                 text,
  telefon                  text,
  email                    text,
  aciklama                 text,
  foto_url                 text,
  sertifika_bilgisi        text,
  sertifika_url            text,
  tamamlanan_proje_sayisi  integer     NOT NULL DEFAULT 0 CHECK (tamamlanan_proje_sayisi >= 0),
  kazanilan_ihale_sayisi   integer     NOT NULL DEFAULT 0 CHECK (kazanilan_ihale_sayisi >= 0),
  aktif_ihale_sayisi       integer     NOT NULL DEFAULT 0 CHECK (aktif_ihale_sayisi >= 0),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_muteahhit_profiller_iller    ON public.muteahhit_profiller USING GIN (calistigi_iller);
CREATE INDEX idx_muteahhit_profiller_uzmanlik ON public.muteahhit_profiller USING GIN (uzmanlik_alanlari);

ALTER TABLE public.muteahhit_profiller ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes muteahhit profillerini gorebilir"
  ON public.muteahhit_profiller FOR SELECT USING (true);

CREATE POLICY "Giris yapan muteahhit profili olusturabilir"
  ON public.muteahhit_profiller FOR INSERT WITH CHECK (auth.uid() = kullanici_id);

CREATE POLICY "Profil sahibi profilini guncelleyebilir"
  ON public.muteahhit_profiller FOR UPDATE USING (auth.uid() = kullanici_id);

CREATE POLICY "Profil sahibi profilini silebilir"
  ON public.muteahhit_profiller FOR DELETE USING (auth.uid() = kullanici_id);

CREATE TRIGGER trg_muteahhit_profiller_updated_at
  BEFORE UPDATE ON public.muteahhit_profiller
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 9. MÜTEAHHİT REFERANS PROJELER
-- ------------------------------------------------------------

CREATE TABLE public.muteahhit_referans_projeler (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  muteahhit_id  uuid        NOT NULL REFERENCES public.muteahhit_profiller(kullanici_id) ON DELETE CASCADE,
  proje_adi     text        NOT NULL,
  konum         text        NOT NULL,
  yil           integer     NOT NULL CHECK (yil >= 1950 AND yil <= 2100),
  tur           text        NOT NULL,
  fotograf_url  text,
  aciklama      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_referans_projeler_muteahhit ON public.muteahhit_referans_projeler(muteahhit_id);

ALTER TABLE public.muteahhit_referans_projeler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes referans projeleri gorebilir"
  ON public.muteahhit_referans_projeler FOR SELECT USING (true);

CREATE POLICY "Profil sahibi proje ekleyebilir"
  ON public.muteahhit_referans_projeler FOR INSERT WITH CHECK (
    auth.uid() = muteahhit_id
  );

CREATE POLICY "Profil sahibi projeyi silebilir"
  ON public.muteahhit_referans_projeler FOR DELETE USING (
    auth.uid() = muteahhit_id
  );

-- ------------------------------------------------------------
-- 10. MÜTEAHHİT YORUMLAR
-- Kullanıcılar müteahhitleri puanlar ve yorum bırakır.
-- ------------------------------------------------------------

CREATE TABLE public.muteahhit_yorumlar (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  muteahhit_id  uuid        NOT NULL REFERENCES public.muteahhit_profiller(kullanici_id) ON DELETE CASCADE,
  kullanici_id  uuid        REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
  kullanici_adi text        NOT NULL,
  puan          smallint    NOT NULL CHECK (puan BETWEEN 1 AND 5),
  yorum_metni   text        NOT NULL CHECK (char_length(yorum_metni) >= 10),
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (muteahhit_id, kullanici_id)
);

CREATE INDEX idx_muteahhit_yorumlar_muteahhit ON public.muteahhit_yorumlar(muteahhit_id);
CREATE INDEX idx_muteahhit_yorumlar_kullanici ON public.muteahhit_yorumlar(kullanici_id);

ALTER TABLE public.muteahhit_yorumlar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Muteahhit yorumlari herkese acik"
  ON public.muteahhit_yorumlar FOR SELECT USING (true);

CREATE POLICY "Giris yapan muteahhite yorum ekleyebilir"
  ON public.muteahhit_yorumlar FOR INSERT WITH CHECK (auth.uid() = kullanici_id);

CREATE POLICY "Kullanici kendi muteahhit yorumunu silebilir"
  ON public.muteahhit_yorumlar FOR DELETE USING (auth.uid() = kullanici_id);

CREATE TRIGGER trg_ihaleler_updated_at
  BEFORE UPDATE ON public.ihaleler
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_danishmanlar_updated_at
  BEFORE UPDATE ON public.danishmanlar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_gorusme_updated_at
  BEFORE UPDATE ON public.danishman_gorusme_talepleri
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 8. DANIŞMAN EŞLEŞTİRME FONKSİYONU
-- Supabase'den çağrılabilir: rpc('danishman_eslestir', {...})
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.danishman_eslestir(
  p_insaat_turu text,
  p_il          text
)
RETURNS TABLE (
  id              uuid,
  ad_soyad        text,
  il              text,
  ilce            text,
  deneyim_yili    integer,
  uzmanlik_puani  integer,
  konum_puani     integer,
  toplam_puan     integer
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    d.id,
    d.ad_soyad,
    d.il,
    d.ilce,
    d.deneyim_yili,
    CASE WHEN p_insaat_turu = ANY(d.uzmanlik_alanlari) THEN 10 ELSE 0 END  AS uzmanlik_puani,
    CASE WHEN d.il = p_il                              THEN 8  ELSE 0 END  AS konum_puani,
    (
      CASE WHEN p_insaat_turu = ANY(d.uzmanlik_alanlari) THEN 10 ELSE 0 END
      + CASE WHEN d.il = p_il                            THEN 8  ELSE 0 END
      + LEAST(d.deneyim_yili, 20)
    ) AS toplam_puan
  FROM public.danishmanlar d
  WHERE d.aktif = true
  ORDER BY toplam_puan DESC;
$$;
