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

DROP TRIGGER IF EXISTS on_auth_user_created         ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;

DROP TABLE IF EXISTS public.bildirim_tercihleri         CASCADE;
DROP TABLE IF EXISTS public.bildirimler                 CASCADE;
DROP TABLE IF EXISTS public.odeme_kayitlari              CASCADE;
DROP TABLE IF EXISTS public.davetler                    CASCADE;
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
DROP TYPE IF EXISTS odul_turu       CASCADE;
DROP TYPE IF EXISTS hesap_turu_tipi CASCADE;
DROP TYPE IF EXISTS mulkiyet_durumu_tipi CASCADE;
DROP TYPE IF EXISTS inceleme_durumu CASCADE;

-- ------------------------------------------------------------
-- 0. ENUM TİPLERİ
-- ------------------------------------------------------------

CREATE TYPE kullanici_rol   AS ENUM ('bireysel', 'firma', 'admin');
CREATE TYPE ihale_durumu    AS ENUM ('aktif', 'beklemede', 'tamamlandi', 'iptal');
CREATE TYPE teklif_durumu   AS ENUM ('beklemede', 'kabul_edildi', 'reddedildi');
CREATE TYPE belge_turu      AS ENUM ('ruhsat', 'proje', 'sozlesme', 'denetim_raporu', 'fotograf', 'diger', 'tapu', 'vekaletname', 'imza_sirkuleri');
CREATE TYPE gorusme_durumu  AS ENUM ('beklemede', 'onaylandi', 'reddedildi', 'tamamlandi');
-- hesap_turu, mevcut "rol" (kullanici_rol) ve plan_turu alanlarından bağımsızdır:
-- yalnızca panel görünümünü ve davet ödül otomasyonunu belirler.
CREATE TYPE hesap_turu_tipi AS ENUM ('arsa_sahibi', 'muteahhit', 'her_ikisi');
-- İhale sahibinin taşınmazla ilişkisi; admin tapu doğrulamasında kullanır.
CREATE TYPE mulkiyet_durumu_tipi AS ENUM ('tek_malik', 'hisseli', 'vekaleten', 'sirket');
-- Admin'in ihaleyi mülkiyet belgelerine göre onaylayıp onaylamadığı.
CREATE TYPE inceleme_durumu AS ENUM ('beklemede', 'onaylandi', 'reddedildi');

-- ------------------------------------------------------------
-- 1. KULLANICILAR
-- auth.users'ı genişleten profil tablosu.
-- Tetikleyici ile her yeni kayıtta otomatik satır oluşur.
-- ------------------------------------------------------------

CREATE TABLE public.kullanicilar (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text        NOT NULL UNIQUE,
  ad_soyad      text        NOT NULL,
  firma_adi     text,
  telefon       text,
  avatar_url    text,
  rol           kullanici_rol NOT NULL DEFAULT 'bireysel',
  hesap_turu    hesap_turu_tipi NOT NULL DEFAULT 'arsa_sahibi',
  davet_kodu    text        UNIQUE,
  davet_eden_id uuid        REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kullanicilar_davet_eden ON public.kullanicilar(davet_eden_id);

ALTER TABLE public.kullanicilar ENABLE ROW LEVEL SECURITY;

-- Kendi tablosuna bakan bir admin kontrolu RLS icinde dogrudan
-- subquery ile yazilirsa (SELECT ... FROM kullanicilar WHERE ...) ozyineli
-- degerlendirmeye yol acabilir; SECURITY DEFINER fonksiyon bunu (RLS'i
-- tamamen atlayarak) guvenli sekilde cozer. Baska admin kontrollerinde de
-- yeniden kullanilabilir.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin');
$$;

-- ONEMLI: bu tablo email, telefon, kalan_teklif_hakki, plan_turu, rol,
-- davet_kodu, davet_eden_id gibi HASSAS alanlar icerir. USING(true) ile
-- herkese acik olsaydi, anon key ile kimlik dogrulamadan TUM
-- kullanicilarin e-postasi/telefonu vb. dogrudan REST API ile
-- cekilebilirdi (canli testle dogrulandi). Sadece kendi satirini ya da
-- admin her satiri gorebilir. Genel goruntuleme (ihale sahibi/teklif
-- veren/muteahhit adi gosterme) icin asagidaki "kullanicilar_ozet"
-- view'i kullanilir (yalnizca ad_soyad/firma_adi/hesap_turu/avatar_url).
CREATE POLICY "Kullanici kendi profilini ve admin herkesi gorebilir"
  ON public.kullanicilar FOR SELECT USING (
    auth.uid() = id OR public.is_admin()
  );

-- auth/callback: Google/Apple ile girişte bir e-postanın BAŞKA bir
-- hesaba zaten kayıtlı olup olmadığını (veri sızdırmadan, sadece
-- boolean) kontrol etmek için — kullanicilar artık başkasının satırını
-- doğrudan SELECT ile göstermiyor.
CREATE OR REPLACE FUNCTION public.email_kayitli_mi(p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.kullanicilar WHERE email = p_email);
$$;
GRANT EXECUTE ON FUNCTION public.email_kayitli_mi(text) TO anon, authenticated;

-- Herkese acik, sadece guvenli/goruntuleme amacli alanlari iceren view.
-- security_invoker=false (varsayilan) BILEREK kullanilir: view'i
-- olusturan rolun (tablo sahibi) yetkisiyle calisir, boylece
-- kullanicilar tablosundaki kisitlayici SELECT RLS'ini bu view icin
-- "atlar" -- view'in SELECT listesi zaten sadece herkese acik
-- alanlarla sinirli oldugundan risk yok. (security_invoker=true
-- yanlislikla denendi, cagiran rolun RLS'ini view'e de uygulayip
-- anon/authenticated icin view'i bos donduruyordu -- canli testte
-- tespit edildi.)
CREATE OR REPLACE VIEW public.kullanicilar_ozet AS
SELECT id, ad_soyad, firma_adi, hesap_turu, avatar_url
FROM public.kullanicilar;

GRANT SELECT ON public.kullanicilar_ozet TO anon, authenticated;

CREATE POLICY "Kullanici kendi profilini guncelleyebilir"
  ON public.kullanicilar FOR UPDATE USING (auth.uid() = id);

-- USING (auth.uid() = id) yalnizca SATIR sahipligini dogrular, HANGI
-- SUTUNUN degistigini kisitlamaz — bu sayede bir kullanici dogrudan
-- PATCH ile kendi rol/kalan_teklif_hakki/plan_turu alanlarini
-- degistirip kendini admin yapabiliyor ya da sinirsiz hak/plan
-- verebiliyordu (canli PoC ile dogrulandi). Bu trigger, admin/sistem
-- disinda bu hassas alanlarin degistirilmesini engeller.
--
-- Sistemin kendi mesru guncellemeleri (teklif hakki dusurme trigger'i,
-- davet odulu uygulama RPC'si) bu kontrolu, islem-lokal bir bayrak
-- (ihaletr.sistem_guncellemesi) ayarlayarak bypass eder.
CREATE OR REPLACE FUNCTION public.kullanici_kisitli_sutun_kontrol()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF current_setting('ihaletr.sistem_guncellemesi', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.rol IS DISTINCT FROM OLD.rol
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.kalan_teklif_hakki IS DISTINCT FROM OLD.kalan_teklif_hakki
     OR NEW.toplam_teklif_sayisi IS DISTINCT FROM OLD.toplam_teklif_sayisi
     OR NEW.plan_turu IS DISTINCT FROM OLD.plan_turu
     OR NEW.premium_bitis_tarihi IS DISTINCT FROM OLD.premium_bitis_tarihi
     OR NEW.davet_kodu IS DISTINCT FROM OLD.davet_kodu
     OR NEW.davet_eden_id IS DISTINCT FROM OLD.davet_eden_id
  THEN
    RAISE EXCEPTION 'KISITLI_ALAN_DEGISTIRILEMEZ: Bu alanlar yalnizca admin/sistem tarafindan degistirilebilir.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kullanici_kisitli_sutun_kontrol ON public.kullanicilar;
CREATE TRIGGER trg_kullanici_kisitli_sutun_kontrol
  BEFORE UPDATE ON public.kullanicilar
  FOR EACH ROW EXECUTE FUNCTION public.kullanici_kisitli_sutun_kontrol();

-- Yeni auth kaydında otomatik profil oluştur.
-- Kayıt sırasında bir davet kodu geldiyse (davet_referans_kodu), davet
-- eden kullanıcıyı bul ve davet_eden_id'yi bağla. E-posta doğrulaması
-- kapalı bir projede kullanıcı anında onaylı geldiyse (email_confirmed_at
-- dolu), ödül kaydını burada başlat — aksi halde bu iş
-- handle_davet_odul_kaydi() tetikleyicisiyle e-posta onayında yapılır.
-- hesap_turu metadata'dan gelir (kayıt formundaki 3 seçenek); tanımsız/
-- geçersizse arsa_sahibi'ye düşer.
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
  mahalle           text,
  ada_no            text,
  parsel_no         text,
  yuzolcumu_m2         numeric,
  yapi_insaat_ruhsati  text CHECK (yapi_insaat_ruhsati IS NULL OR yapi_insaat_ruhsati IN ('var', 'yok')),
  proje                text CHECK (proje IS NULL OR proje IN ('var', 'yok')),
  goruntulenme_sayisi  integer       NOT NULL DEFAULT 0,
  olusturan_id      uuid          REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
  -- Taşınmaz mülkiyet doğrulama (admin incelemesi için)
  mulkiyet_durumu    mulkiyet_durumu_tipi,
  basvuru_sahibi_adi text,              -- oluşturma anındaki kullanicilar.ad_soyad kopyası
  sirket_unvani      text,              -- yalnızca mulkiyet_durumu = 'sirket'
  yetkili_kisi_adi   text,              -- yalnızca mulkiyet_durumu = 'sirket'
  inceleme_durumu    inceleme_durumu NOT NULL DEFAULT 'beklemede',
  red_sebebi         text,
  otomatik_sonlandirildi boolean    NOT NULL DEFAULT false,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT bitis_baslangictan_sonra CHECK (bitis_tarihi > baslangic_tarihi),
  CONSTRAINT red_sebebi_zorunlu CHECK (
    inceleme_durumu <> 'reddedildi'
    OR (red_sebebi IS NOT NULL AND length(trim(red_sebebi)) > 0)
  )
);

CREATE INDEX idx_ihaleler_durum    ON public.ihaleler(durum);
CREATE INDEX idx_ihaleler_kategori ON public.ihaleler(kategori);
CREATE INDEX idx_ihaleler_sehir    ON public.ihaleler(sehir);
CREATE INDEX idx_ihaleler_bitis    ON public.ihaleler(bitis_tarihi);
CREATE INDEX idx_ihaleler_inceleme_durumu ON public.ihaleler(inceleme_durumu);
CREATE INDEX idx_ihaleler_olusturan ON public.ihaleler(olusturan_id);

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

-- Admin, mülkiyet doğrulama incelemesi için herhangi bir ihaleyi
-- (inceleme_durumu/red_sebebi) güncelleyebilir.
CREATE POLICY "Admin ihaleyi inceleyebilir"
  ON public.ihaleler FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Olusturan ihalesini silebilir"
  ON public.ihaleler FOR DELETE USING (auth.uid() = olusturan_id);

-- Ihale olusturmada hic hiz siniri yoktu -- bir kullanici sinirsiz ihale
-- acip platformu spam'leyebilirdi (canli testte dogrulandi: 10 ardisik
-- istek 10/10 basarili oldu). Misafir akisi (olusturan_id NULL) IP
-- bazli sinirlama pratik olmadigindan kapsam disi birakildi.
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

-- Ihale sahibi kendi satirinin HER sutununu guncelleyebilir (yukaridaki
-- USING politikasi satir bazlidir, sutun kisitlamaz) — bu, sahibin
-- dogrudan PATCH ile inceleme_durumu'nu kendi kendine "onaylandi" yaparak
-- admin mulkiyet incelemesini bypass edebilmesine izin verirdi. Bu
-- trigger, admin/sistem disinda inceleme_durumu, red_sebebi ve
-- otomatik_sonlandirildi alanlarinin degistirilmesini engeller.
CREATE OR REPLACE FUNCTION public.ihale_kisitli_sutun_kontrol()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  admin_mi boolean;
BEGIN
  -- service_role / pg_cron baglaminda (auth.uid() NULL) serbest birak
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

  -- Not: mevcut_teklif / goruntulenme_sayisi kasitli olarak bu kontrolun
  -- disinda birakildi. guncelle_mevcut_teklif() artik SECURITY DEFINER
  -- oldugundan (RLS'i atlar) bu trigger'i hic tetiklemez/etkilemez zaten;
  -- mevcut_teklif her yeni teklifte yeniden hesaplandigindan (MIN(tutar))
  -- manuel bir PATCH kalici bir etki yaratamaz; risk dusuk kabul edilip
  -- disarida birakildi.

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ihale_kisitli_sutun_kontrol ON public.ihaleler;
CREATE TRIGGER trg_ihale_kisitli_sutun_kontrol
  BEFORE UPDATE ON public.ihaleler
  FOR EACH ROW EXECUTE FUNCTION public.ihale_kisitli_sutun_kontrol();

-- ------------------------------------------------------------
-- 3. TEKLİFLER
-- ------------------------------------------------------------

CREATE TABLE public.teklifler (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  ihale_id      uuid          NOT NULL REFERENCES public.ihaleler(id) ON DELETE CASCADE,
  kullanici_id  uuid          NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  tutar         numeric(15,2) NOT NULL CHECK (tutar > 0),
  aciklama      text,
  durum         teklif_durumu NOT NULL DEFAULT 'beklemede',
  created_at    timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (ihale_id, kullanici_id)  -- bir kullanıcı aynı ihaleye tek teklif
);

CREATE INDEX idx_teklifler_ihale     ON public.teklifler(ihale_id);
CREATE INDEX idx_teklifler_kullanici ON public.teklifler(kullanici_id);

ALTER TABLE public.teklifler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ihale sahibi ve teklif sahibi teklifleri gorebilir"
  ON public.teklifler FOR SELECT USING (
    auth.uid() = kullanici_id
    OR auth.uid() = (SELECT olusturan_id FROM public.ihaleler WHERE id = ihale_id)
  );

CREATE POLICY "Giris yapan teklif verebilir"
  ON public.teklifler FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = kullanici_id
    AND auth.uid() IS DISTINCT FROM (SELECT olusturan_id FROM public.ihaleler WHERE id = ihale_id)
  );

CREATE POLICY "Teklif sahibi teklifini silebilir"
  ON public.teklifler FOR DELETE USING (auth.uid() = kullanici_id);

-- Teklif hakki bitmis kullanici INSERT deneseydi bile DB seviyesinde reddedilsin
-- (istemci tarafi kontrolu yalnizca kullanici deneyimi icindir, guvenlik siniri degil)
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

-- Teklif eklenince/silininde ihaledeki mevcut_teklif'i otomatik güncelle.
-- DELETE de dahil edilmezse (ör. bir kullanici hesabini silince teklifleri
-- CASCADE ile silinince) mevcut_teklif artik var olmayan bir teklifi
-- gostermeye devam ederdi (bayat/yanlis veri).
--
-- SECURITY DEFINER ZORUNLU: bu trigger, teklifi VEREN kullanicinin kendi
-- oturumuyla (invoker olarak) calisirsa, teklif veren kisi o ihalenin
-- SAHIBI degilse (ki normal/en yaygin senaryo tam olarak budur) ihaleler
-- UPDATE RLS politikasi (sadece sahibi/admin) bu UPDATE'i SESSIZCE 0
-- satir etkileyerek engeller (hata firlatmaz) — mevcut_teklif hicbir
-- zaman guncellenmez. Canli testte dogrulandi: bidder != owner
-- senaryosunda mevcut_teklif null kaliyordu. SECURITY DEFINER, RLS'i
-- tamamen atlayip bu SATIR-SEVIYESI hesaplama sistemin kendi isi olarak
-- her zaman calismasini saglar (fonksiyon icinde kullanici girdisiyle
-- keyfi bir ihale/deger yazilamiyor, sadece MIN(tutar) hesabi yapiyor).
CREATE OR REPLACE FUNCTION public.guncelle_mevcut_teklif()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Not: "Yalnizca admin tarafindan eklenir" tasarim niyetine ragmen bu
-- politikalar onceden herhangi bir giris yapmis kullaniciya acikti; admin
-- kontrolu eklendi. (Danisman sayfalari ayri bir kararla pasif birakildi,
-- bu sadece arka uctaki acik yetki deligini kapatir.)
CREATE POLICY "Sadece admin danisman ekleyebilir"
  ON public.danishmanlar FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Sadece admin danisman guncelleyebilir"
  ON public.danishmanlar FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Sadece admin danisman silebilir"
  ON public.danishmanlar FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

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

-- Tapu, vekaletname ve imza sirküleri yalnızca mülkiyet doğrulama
-- amaçlıdır; ihale sahibi, teklif veren müteahhitler ya da başka hiçbir
-- kullanıcı göremez/indiremez. Sadece admin rolündeki kullanıcılar erişebilir.
CREATE POLICY "Hassas belgeler sadece admin, digerleri herkese acik"
  ON public.belgeler FOR SELECT USING (
    tur NOT IN ('tapu', 'vekaletname', 'imza_sirkuleri')
    OR EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

-- GEÇİCİ: Misafir kullanıcıların da belge yükleyebilmesi için genişletildi. Eski hali:
-- CREATE POLICY "Giris yapan belge yukleyebilir"
--   ON public.belgeler FOR INSERT WITH CHECK (auth.uid() = yukleyen_id);
-- yukleyen_id kontrolunun yani sira, belge bir ihaleye bagliysa (ihale_id
-- NOT NULL) o ihalenin GERCEKTEN yukleyene ait oldugu da dogrulanir —
-- aksi halde herhangi bir kullanici baskasinin ihalesine sahte bir tapu/
-- belge satiri ekleyip admin incelemesini karistirabilirdi.
CREATE POLICY "Giris yapan ya da misafir belge yukleyebilir"
  ON public.belgeler FOR INSERT WITH CHECK (
    (
      (auth.uid() IS NOT NULL AND auth.uid() = yukleyen_id)
      OR (auth.uid() IS NULL AND yukleyen_id IS NULL)
    )
    AND (
      ihale_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.ihaleler
        WHERE id = ihale_id
          AND (olusturan_id = auth.uid() OR (olusturan_id IS NULL AND auth.uid() IS NULL))
      )
    )
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
  PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
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

-- Odenen teklif paketi sonrasi kalan_teklif_hakki'i tek atomik UPDATE ile
-- artirir (oku-hesapla-yaz yerine) — eszamanli iki odeme tamamlanmasi
-- (webhook tekrari, cift tiklama vb.) birbirinin yazdigini ezemez.
-- Yalnizca service_role (api/odeme/route.ts) cagirabilir.
CREATE OR REPLACE FUNCTION public.artir_teklif_hakki(p_kullanici_id uuid, p_miktar integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yeni_hak integer;
BEGIN
  PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
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
  yetki_belgesi_grubu      text CHECK (yetki_belgesi_grubu IN ('A','B','C','D','E','F','G','H','Geçici/Y Belgesi')),
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

-- muteahhit_id <> kullanici_id: bir muteahhit kendi profiline sahte
-- olumlu yorum/puan ekleyemesin (self-review).
CREATE POLICY "Giris yapan muteahhite yorum ekleyebilir"
  ON public.muteahhit_yorumlar FOR INSERT WITH CHECK (
    auth.uid() = kullanici_id AND muteahhit_id <> kullanici_id
  );

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

-- ------------------------------------------------------------
-- 9. TAPU BELGELERİ — ÖZEL (PRIVATE) STORAGE BUCKET
-- Not: "ihale-belgeleri" bucket'ı (şartname/proje/sözleşme dosyaları için)
-- herkese açık (public) olarak Supabase panelinden manuel oluşturulur ve
-- bu dosya kapsamının dışındadır. Tapu Fotokopisi ise gerçeklik doğrulama
-- amaçlı olduğundan ayrı, herkese kapalı bir bucket'ta tutulur ve yalnızca
-- admin rolündeki kullanıcılar storage.objects RLS politikasıyla okuyabilir.
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('ihale-tapu-belgeleri', 'ihale-tapu-belgeleri', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Sadece admin tapu belgesini gorebilir"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'ihale-tapu-belgeleri'
    AND EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND rol = 'admin')
  );

-- İhale oluşturma formu tapu belgesini herkes (giriş yapan ya da misafir)
-- yükleyebilir — public.belgeler tablosundaki yükleme politikasıyla tutarlı.
CREATE POLICY "Herkes tapu belgesi yukleyebilir"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'ihale-tapu-belgeleri'
  );

-- ------------------------------------------------------------
-- 10. ARKADAŞINI DAVET ET SİSTEMİ
-- Her kullanıcının benzersiz bir davet_kodu'su vardır (bkz. handle_new_user).
-- Yeni kullanıcı bu kodla kayıt olup e-postasını onaylayınca
-- davet_odulunu_baslat() çağrılır. Ödül türü davet eden kişinin
-- hesap_turu'suna göre otomatik belirlenir:
--   - muteahhit  → +1 teklif hakkı, anında uygulanır (bekleme yok).
--   - arsa_sahibi → 15 gün süre uzatma; tam olarak 1 aktif ihalesi varsa
--     anında o ihaleye uygulanır, değilse (0 ya da >1) panelden hangi
--     ihaleye uygulanacağı seçilene kadar bekler.
--   - her_ikisi  → ödül türünü de, ihaleyi de davet eden kişi panelden
--     seçer (eski davranış).
-- Panelden yapılan seçim davet_odulu_uygula() RPC'si ile uygulanır.
-- ------------------------------------------------------------

CREATE TYPE odul_turu AS ENUM ('teklif_hakki', 'sure_uzatma');

-- Benzersiz, 8 karakterlik davet kodu üretir.
CREATE OR REPLACE FUNCTION public.gen_davet_kodu()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_kod text;
BEGIN
  LOOP
    v_kod := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.kullanicilar WHERE davet_kodu = v_kod);
  END LOOP;
  RETURN v_kod;
END;
$$;

-- Bu SQL sıfırdan kurulumda no-op'tur (kullanicilar boş); canlı bir
-- projeye bu bölüm eklendiğinde mevcut kullanıcılara davet kodu atar.
UPDATE public.kullanicilar SET davet_kodu = public.gen_davet_kodu() WHERE davet_kodu IS NULL;

CREATE TABLE public.davetler (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  davet_eden_id        uuid        NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  davet_edilen_id      uuid        NOT NULL UNIQUE REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  odul_verildi         boolean     NOT NULL DEFAULT false,
  odul_turu            odul_turu,
  uygulanan_ihale_id   uuid        REFERENCES public.ihaleler(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  odul_verildi_tarihi  timestamptz
);

CREATE INDEX idx_davetler_eden  ON public.davetler(davet_eden_id);
CREATE INDEX idx_davetler_durum ON public.davetler(odul_verildi);

ALTER TABLE public.davetler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Davet eden kendi davetlerini gorebilir"
  ON public.davetler FOR SELECT USING (auth.uid() = davet_eden_id);

-- Davet eden kişinin hesap_turu'suna göre ödülü ya anında uygular ya da
-- panelden seçilmek üzere bekleyen bir kayıt açar. SECURITY DEFINER —
-- yalnızca handle_new_user/handle_davet_odul_kaydi tetikleyicilerinden
-- çağrılır, doğrudan istemciden çağrılamaz (public RPC olarak açılmadı).
CREATE OR REPLACE FUNCTION public.davet_odulunu_baslat(p_eden_id uuid, p_edilen_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hesap_turu  hesap_turu_tipi;
  v_ihale_id    uuid;
  v_aktif_sayi  integer;
BEGIN
  SELECT hesap_turu INTO v_hesap_turu FROM public.kullanicilar WHERE id = p_eden_id;

  IF v_hesap_turu = 'muteahhit' THEN
    PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
    UPDATE public.kullanicilar
    SET kalan_teklif_hakki = CASE
      WHEN kalan_teklif_hakki >= 99999 THEN kalan_teklif_hakki
      ELSE kalan_teklif_hakki + 1
    END
    WHERE id = p_eden_id;

    INSERT INTO public.davetler (davet_eden_id, davet_edilen_id, odul_verildi, odul_turu, odul_verildi_tarihi)
    VALUES (p_eden_id, p_edilen_id, true, 'teklif_hakki', now())
    ON CONFLICT (davet_edilen_id) DO NOTHING;

  ELSIF v_hesap_turu = 'arsa_sahibi' THEN
    SELECT count(*) INTO v_aktif_sayi FROM public.ihaleler WHERE olusturan_id = p_eden_id AND durum = 'aktif';

    IF v_aktif_sayi = 1 THEN
      SELECT id INTO v_ihale_id FROM public.ihaleler WHERE olusturan_id = p_eden_id AND durum = 'aktif';

      UPDATE public.ihaleler SET bitis_tarihi = bitis_tarihi + 15 WHERE id = v_ihale_id;

      INSERT INTO public.davetler (davet_eden_id, davet_edilen_id, odul_verildi, odul_turu, uygulanan_ihale_id, odul_verildi_tarihi)
      VALUES (p_eden_id, p_edilen_id, true, 'sure_uzatma', v_ihale_id, now())
      ON CONFLICT (davet_edilen_id) DO NOTHING;
    ELSE
      -- 0 ya da >1 aktif ihale: hangisine uygulanacağı panelden seçilecek.
      INSERT INTO public.davetler (davet_eden_id, davet_edilen_id, odul_turu)
      VALUES (p_eden_id, p_edilen_id, 'sure_uzatma')
      ON CONFLICT (davet_edilen_id) DO NOTHING;
    END IF;

  ELSE -- her_ikisi: ödül türünü de ihaleyi de davet eden kişi panelden seçer
    INSERT INTO public.davetler (davet_eden_id, davet_edilen_id)
    VALUES (p_eden_id, p_edilen_id)
    ON CONFLICT (davet_edilen_id) DO NOTHING;
  END IF;
END;
$$;

-- E-posta onaylanınca (email_confirmed_at NULL'dan dolu hale geçince)
-- ödül sürecini başlat.
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
END;
$$;

CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_davet_odul_kaydi();

-- Davet eden kişi bekleyen ödülünü uygular (panelden çağrılır).
-- odul_turu davet açılışında zaten belirlenmişse (arsa_sahibi → sure_uzatma)
-- istemciden gelen p_odul_turu yok sayılır, kayıttaki tür esas alınır —
-- yalnızca her_ikisi kaynaklı (odul_turu NULL) davetlerde istemci seçimi
-- geçerlidir. auth.uid() ile davet_eden_id eşleşmesi ve daha önce ödül
-- verilmediği kontrol edilir; bu yüzden SECURITY DEFINER olmasına rağmen
-- anon-key ile çağrılması güvenlidir.
CREATE OR REPLACE FUNCTION public.davet_odulu_uygula(
  p_davet_id  uuid,
  p_odul_turu odul_turu,
  p_ihale_id  uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_davet     public.davetler%ROWTYPE;
  v_odul_turu odul_turu;
BEGIN
  SELECT * INTO v_davet FROM public.davetler WHERE id = p_davet_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Davet bulunamadı';
  END IF;

  IF v_davet.davet_eden_id <> auth.uid() THEN
    RAISE EXCEPTION 'Bu davet size ait değil';
  END IF;

  IF v_davet.odul_verildi THEN
    RAISE EXCEPTION 'Bu davet için ödül zaten verildi';
  END IF;

  v_odul_turu := COALESCE(v_davet.odul_turu, p_odul_turu);

  IF v_odul_turu = 'teklif_hakki' THEN
    PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
    UPDATE public.kullanicilar
    SET kalan_teklif_hakki = CASE
      WHEN kalan_teklif_hakki >= 99999 THEN kalan_teklif_hakki
      ELSE kalan_teklif_hakki + 1
    END
    WHERE id = auth.uid();

  ELSIF v_odul_turu = 'sure_uzatma' THEN
    IF p_ihale_id IS NULL THEN
      RAISE EXCEPTION 'İhale seçimi zorunludur';
    END IF;

    UPDATE public.ihaleler
    SET bitis_tarihi = bitis_tarihi + 15
    WHERE id = p_ihale_id AND olusturan_id = auth.uid() AND durum = 'aktif';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'İhale bulunamadı ya da size ait aktif bir ihale değil';
    END IF;
  END IF;

  UPDATE public.davetler
  SET odul_verildi        = true,
      odul_turu            = v_odul_turu,
      uygulanan_ihale_id   = p_ihale_id,
      odul_verildi_tarihi  = now()
  WHERE id = p_davet_id;
END;
$$;

-- signInWithOAuth() bir signUp() gibi bizim custom metadata'mızı taşımaz
-- (data alanı yok); bu yüzden hesap_turu seçimi ve davet kodu bağlantısı
-- Google/Apple ile kayıtta /auth/callback rotasından, oturum açıldıktan
-- hemen sonra bu RPC ile tamamlanır. auth.uid() = kendi profili dışında
-- hiçbir satırı etkilemez.
CREATE OR REPLACE FUNCTION public.oauth_kayit_tamamla(
  p_hesap_turu hesap_turu_tipi DEFAULT NULL,
  p_ref_kodu   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_eden_id  uuid;
  v_mevcut   uuid;
BEGIN
  IF p_hesap_turu IS NOT NULL THEN
    UPDATE public.kullanicilar SET hesap_turu = p_hesap_turu WHERE id = auth.uid();
  END IF;

  IF p_ref_kodu IS NOT NULL THEN
    SELECT davet_eden_id INTO v_mevcut FROM public.kullanicilar WHERE id = auth.uid();

    IF v_mevcut IS NULL THEN
      SELECT id INTO v_eden_id FROM public.kullanicilar WHERE davet_kodu = upper(p_ref_kodu);

      IF v_eden_id IS NOT NULL AND v_eden_id <> auth.uid() THEN
        PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);
        UPDATE public.kullanicilar SET davet_eden_id = v_eden_id WHERE id = auth.uid();

        IF (SELECT email_confirmed_at FROM auth.users WHERE id = auth.uid()) IS NOT NULL THEN
          PERFORM public.davet_odulunu_baslat(v_eden_id, auth.uid());
        END IF;
      END IF;
    END IF;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 11. OTOMATİK İHALE SONLANDIRMA (pg_cron)
-- Süresi dolduktan (bitis_tarihi) sonra 2 gün içinde sahibi tarafından
-- bir karar (uzatma) verilmezse ihale otomatik olarak "tamamlandi"
-- yapılır. pg_cron extension'ı Supabase Dashboard > Database >
-- Extensions'tan aktif edilmelidir (bkz. supabase/otomatik_sonlandirma_migration.sql
-- - fresh install'de bu script otomatik çalışmaz, extension'ın ayrıca
-- etkinleştirilip zamanlanması gerekir).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ihale_otomatik_sonlandir()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ihaleler
  SET durum = 'tamamlandi',
      otomatik_sonlandirildi = true,
      updated_at = now()
  WHERE durum = 'aktif'
    AND bitis_tarihi < (CURRENT_DATE - 2);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ihale_otomatik_sonlandir() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ihale_otomatik_sonlandir() TO service_role;

-- ------------------------------------------------------------
-- 12. ÖDEME KAYITLARI (audit log + rate limiting + mutabakat)
-- api/odeme/route.ts her odeme denemesini (basarili/basarisiz/DB
-- guncelleme hatasi) buraya yazar. Uc amaca hizmet eder:
--  1) Audit log: kritik odeme olaylari artik sadece console.error
--     degil, sorgulanabilir bir tabloda.
--  2) Rate limiting: kart deneme (card testing) saldirisina karsi,
--     route bu tabloyu sorgulayip kisa surede cok fazla deneme varsa
--     reddeder.
--  3) Mutabakat: Iyzico odemesi basarili ama plan/hak guncellemesi
--     basarisiz olursa (ör. gecici DB hatasi) bu durum "basarisiz
--     sessizce yutulmak" yerine kayit altina alinir.
-- ------------------------------------------------------------

CREATE TABLE public.odeme_kayitlari (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kullanici_id      uuid        NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  paket             text        NOT NULL,
  iyzico_payment_id text,
  durum             text        NOT NULL CHECK (durum IN ('basarili', 'basarisiz', 'db_guncelleme_hatasi')),
  hata_mesaji       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_odeme_kayitlari_kullanici ON public.odeme_kayitlari(kullanici_id, created_at);

ALTER TABLE public.odeme_kayitlari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanici kendi odeme kayitlarini gorebilir"
  ON public.odeme_kayitlari FOR SELECT USING (auth.uid() = kullanici_id);

CREATE POLICY "Admin tum odeme kayitlarini gorebilir"
  ON public.odeme_kayitlari FOR SELECT USING (public.is_admin());

-- INSERT yalnizca service_role'den (api/odeme/route.ts) gelir; service
-- role RLS'i tamamen atladigi icin ayri bir INSERT politikasi gerekmez,
-- authenticated/anon icin INSERT taniml bile degil (varsayilan: red).

-- ------------------------------------------------------------
-- 13. BİLDİRİMLER
-- Kullaniciya ait, uygulama ici bildirimler. Yalnizca sistem (SECURITY
-- DEFINER trigger'lar) INSERT edebilir; kullanici sadece kendi
-- bildirimlerini gorebilir/okundu isaretleyebilir/silebilir.
-- ------------------------------------------------------------

CREATE TABLE public.bildirimler (
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

CREATE INDEX idx_bildirimler_kullanici  ON public.bildirimler(kullanici_id, created_at DESC);
CREATE INDEX idx_bildirimler_okunmamis  ON public.bildirimler(kullanici_id) WHERE okundu = false;

ALTER TABLE public.bildirimler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanici kendi bildirimlerini gorebilir"
  ON public.bildirimler FOR SELECT USING (auth.uid() = kullanici_id);

-- INSERT icin kasitli olarak hicbir politika yok: bildirimler sadece
-- asagidaki SECURITY DEFINER trigger fonksiyonlariyla (RLS'i atlayarak)
-- olusturulur, istemci dogrudan sahte bildirim ekleyemez.

CREATE POLICY "Kullanici kendi bildirimini guncelleyebilir"
  ON public.bildirimler FOR UPDATE USING (auth.uid() = kullanici_id);

-- USING (auth.uid() = kullanici_id) yalnizca satir sahipligini dogrular;
-- kullanicinin sadece "okundu" alanini degistirebilmesi, baslik/mesaj/
-- tur gibi alanlari kendi uydurmasini engellemek icin trigger'la
-- kisitlaniyor (bu oturumda kullanicilar/ihaleler icin kurulan ayni
-- desen).
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

DROP TRIGGER IF EXISTS trg_bildirim_ihale_durumu ON public.ihaleler;
CREATE TRIGGER trg_bildirim_ihale_durumu
  AFTER UPDATE ON public.ihaleler
  FOR EACH ROW EXECUTE FUNCTION public.bildirim_ihale_durumu();

-- 3) Davet ödülü uygulanınca davet edene bildirim.
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

DROP TRIGGER IF EXISTS trg_bildirim_davet_odulu ON public.davetler;
CREATE TRIGGER trg_bildirim_davet_odulu
  AFTER INSERT OR UPDATE ON public.davetler
  FOR EACH ROW EXECUTE FUNCTION public.bildirim_davet_odulu();

-- 4) Ödeme sonrası kredi/plan güncellemesi başarısız olursa (mutabakat
-- hatası) kullaniciya bildirim.
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

DROP TRIGGER IF EXISTS trg_bildirim_odeme_sorunu ON public.odeme_kayitlari;
CREATE TRIGGER trg_bildirim_odeme_sorunu
  AFTER INSERT ON public.odeme_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.bildirim_odeme_sorunu();

-- ------------------------------------------------------------
-- 14. BİLDİRİM TERCİHLERİ
-- Kullanici hangi bildirim turlerini almak istedigini kapatabilir.
-- Yeni kayitta handle_new_user() otomatik varsayilan (hepsi acik) satir
-- olusturur; mevcut kullanicilar icin asagida bir kerelik backfill var.
-- ------------------------------------------------------------

CREATE TABLE public.bildirim_tercihleri (
  kullanici_id    uuid        PRIMARY KEY REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  yeni_teklif     boolean     NOT NULL DEFAULT true,
  ihale_durumu    boolean     NOT NULL DEFAULT true,
  davet_odulu     boolean     NOT NULL DEFAULT true,
  odeme_sorunu    boolean     NOT NULL DEFAULT true,
  bolge_eslesmesi boolean     NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bildirim_tercihleri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanici kendi tercihlerini gorebilir"
  ON public.bildirim_tercihleri FOR SELECT USING (auth.uid() = kullanici_id);

CREATE POLICY "Kullanici kendi tercihlerini olusturabilir"
  ON public.bildirim_tercihleri FOR INSERT WITH CHECK (auth.uid() = kullanici_id);

CREATE POLICY "Kullanici kendi tercihlerini guncelleyebilir"
  ON public.bildirim_tercihleri FOR UPDATE USING (auth.uid() = kullanici_id) WITH CHECK (auth.uid() = kullanici_id);

CREATE TRIGGER trg_bildirim_tercihleri_updated_at
  BEFORE UPDATE ON public.bildirim_tercihleri
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Mevcut kullanicilar icin bir kerelik backfill (yeni kullanicilar
-- handle_new_user() ile otomatik alir).
INSERT INTO public.bildirim_tercihleri (kullanici_id)
SELECT id FROM public.kullanicilar
ON CONFLICT (kullanici_id) DO NOTHING;

-- ------------------------------------------------------------
-- 15. BÖLGE EŞLEŞMESİ BİLDİRİMİ
-- Bir ihale admin tarafindan onaylanip yayina girince, calistigi_iller
-- listesinde o ilin gectigi muteahhitlere "bolgenizde yeni ihale var"
-- bildirimi gonderilir. (E-posta gonderimi kapsam disi birakildi;
-- ileride Resend/SendGrid gibi bir servisle ayri bir adimda eklenebilir
-- -- su an sadece uygulama-ici bildirim.)
-- ------------------------------------------------------------

-- 'tur' CHECK kisitini 'bolge_eslesmesi' turunu de kabul edecek sekilde
-- genisletir. Unnamed column CHECK'in varsayilan adi {tablo}_{sutun}_check.
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
-- 16. REALTIME
-- bildirimler tablosunu Supabase Realtime yayinina ekler (Navbar'daki
-- zil ikonu canli guncellenebilsin diye). Zaten ekliyse hata vermeden
-- atlar.
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
