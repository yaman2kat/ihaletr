-- ============================================================
-- 15 DÜZELTME — kimlik doğrulama, örnek şartnameler, yayınlanma
-- anından itibaren geri sayım, "Beklemede" kök sebep backfill,
-- realtime.
-- Supabase Dashboard > SQL Editor'a yapıştırıp çalıştırın.
-- ============================================================

-- ------------------------------------------------------------
-- 1. KULLANICILAR — bireysel/kurumsal ayrımı + kimlik doğrulama durumu
--
-- ÖNEMLİ: kullanicilar.hesap_turu (arsa_sahibi/muteahhit/her_ikisi)
-- ZATEN VAR ve panel görünümünü belirliyor -- bununla ÇAKIŞMAMASI için
-- bireysel/kurumsal ayrımı burada YENİ bir sütunda (kisi_turu) tutulur.
--
-- Mevcut kullanıcılar (bu migrasyondan önce kayıt olmuş herkes,
-- gerçek/test hesapları dahil) geriye dönük olarak "onaylandi" sayılır
-- -- aksi halde bu migration'dan sonra hiçbir mevcut kullanıcı ihale
-- açamaz/teklif veremezdi. Yalnızca BUNDAN SONRA kayıt olanlar
-- "bekliyor" ile başlayıp onboarding'den geçer.
-- ------------------------------------------------------------

ALTER TABLE public.kullanicilar
  ADD COLUMN IF NOT EXISTS kisi_turu text CHECK (kisi_turu IS NULL OR kisi_turu IN ('bireysel', 'kurumsal')),
  ADD COLUMN IF NOT EXISTS kimlik_dogrulama_durumu text NOT NULL DEFAULT 'bekliyor'
    CHECK (kimlik_dogrulama_durumu IN ('bekliyor', 'onaylandi', 'reddedildi')),
  ADD COLUMN IF NOT EXISTS kimlik_dogrulama_notu text;

UPDATE public.kullanicilar SET kimlik_dogrulama_durumu = 'onaylandi' WHERE kimlik_dogrulama_durumu = 'bekliyor';

-- kullanici_kisitli_sutun_kontrol() tetikleyicisi, kullanicinin dogrudan
-- PATCH ile kendi rol/kalan_teklif_hakki/plan_turu gibi hassas alanlarini
-- degistirmesini engelliyordu -- ama kimlik_dogrulama_durumu bu listede
-- YOKTU, yani bir kullanici dogrudan
-- `update({kimlik_dogrulama_durumu:'onaylandi'})` ile kendi kimligini
-- kendi kendine "onaylandi" yapip admin incelemesini tamamen bypass
-- edebilirdi. Bu, ihale acma/teklif verme RLS kapisinin butun amacini
-- gecersiz kilardi -- bu yuzden asagida ayni tetikleyiciye eklenir.
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
     OR NEW.uzatma_havuzu_gun IS DISTINCT FROM OLD.uzatma_havuzu_gun
     OR NEW.kimlik_dogrulama_durumu IS DISTINCT FROM OLD.kimlik_dogrulama_durumu
     OR NEW.kimlik_dogrulama_notu IS DISTINCT FROM OLD.kimlik_dogrulama_notu
     OR (OLD.ucretsiz_ihale_hakki_kullanildi AND NOT COALESCE(NEW.ucretsiz_ihale_hakki_kullanildi, false))
  THEN
    RAISE EXCEPTION 'KISITLI_ALAN_DEGISTIRILEMEZ: Bu alanlar yalnizca admin/sistem tarafindan degistirilebilir.';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 2. KİMLİK DOĞRULAMA BAŞVURULARI
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kimlik_dogrulama_basvurulari (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kullanici_id           uuid        NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  kisi_turu              text        NOT NULL CHECK (kisi_turu IN ('bireysel', 'kurumsal')),
  ad_soyad               text,
  firma_adi              text,
  tc_kimlik_no           text,
  vergi_no               text,
  kimlik_on_url          text,
  kimlik_arka_url        text,
  selfie_url             text,
  imza_sirkuleri_url     text,
  ticaret_sicil_url      text,
  otomatik_kontrol_sonucu text NOT NULL CHECK (otomatik_kontrol_sonucu IN ('otomatik_onay_bekliyor', 'manuel_inceleme')),
  admin_karari           text NOT NULL DEFAULT 'bekliyor' CHECK (admin_karari IN ('bekliyor', 'onaylandi', 'reddedildi')),
  red_notu               text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kimlik_basvuru_kullanici ON public.kimlik_dogrulama_basvurulari(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_kimlik_basvuru_karar     ON public.kimlik_dogrulama_basvurulari(admin_karari);

ALTER TABLE public.kimlik_dogrulama_basvurulari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kullanici kendi basvurusunu gorebilir" ON public.kimlik_dogrulama_basvurulari;
CREATE POLICY "Kullanici kendi basvurusunu gorebilir"
  ON public.kimlik_dogrulama_basvurulari FOR SELECT USING (
    auth.uid() = kullanici_id OR public.is_admin()
  );

-- admin_karari = 'bekliyor' sarti: aksi halde bir kullanici INSERT
-- govdesine dogrudan admin_karari:'onaylandi' yazip hicbir admin
-- incelemesi olmadan "onayli gorunen" bir basvuru olusturabilirdi
-- (kullanicilar.kimlik_dogrulama_durumu bunu otomatik degistirmese de --
-- senkron trigger'i yalnizca UPDATE'te calisir -- yanlis/kafa karistirici
-- veri admin listesine dusmesin diye baslangicta engellenir).
DROP POLICY IF EXISTS "Kullanici kendi basvurusunu olusturabilir" ON public.kimlik_dogrulama_basvurulari;
CREATE POLICY "Kullanici kendi basvurusunu olusturabilir"
  ON public.kimlik_dogrulama_basvurulari FOR INSERT WITH CHECK (
    auth.uid() = kullanici_id AND admin_karari = 'bekliyor'
  );

DROP POLICY IF EXISTS "Admin basvuru kararini guncelleyebilir" ON public.kimlik_dogrulama_basvurulari;
CREATE POLICY "Admin basvuru kararini guncelleyebilir"
  ON public.kimlik_dogrulama_basvurulari FOR UPDATE USING (public.is_admin());

-- Admin bir başvuruyu onaylayıp/reddettiğinde kullanicilar.kimlik_dogrulama_durumu'nu
-- da senkron tutar (istemci iki ayrı UPDATE yapmak zorunda kalmasın diye).
CREATE OR REPLACE FUNCTION public.kimlik_basvuru_karar_senkron()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.admin_karari IS DISTINCT FROM OLD.admin_karari AND NEW.admin_karari IN ('onaylandi', 'reddedildi') THEN
    UPDATE public.kullanicilar
    SET kimlik_dogrulama_durumu = NEW.admin_karari,
        kimlik_dogrulama_notu   = NEW.red_notu
    WHERE id = NEW.kullanici_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kimlik_basvuru_karar_senkron ON public.kimlik_dogrulama_basvurulari;
CREATE TRIGGER trg_kimlik_basvuru_karar_senkron
  AFTER UPDATE ON public.kimlik_dogrulama_basvurulari
  FOR EACH ROW EXECUTE FUNCTION public.kimlik_basvuru_karar_senkron();

-- ------------------------------------------------------------
-- 3. KİMLİK BELGELERİ — ÖZEL (PRIVATE) STORAGE BUCKET
-- Obje yolu: {kullanici_id}/... -- yalnızca sahibi yükleyebilir,
-- yalnızca admin görüntüleyebilir.
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('admin_belgeler_dogrulama', 'admin_belgeler_dogrulama', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Kullanici kendi kimlik belgesini yukleyebilir" ON storage.objects;
CREATE POLICY "Kullanici kendi kimlik belgesini yukleyebilir"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'admin_belgeler_dogrulama'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Sadece admin kimlik belgesini gorebilir" ON storage.objects;
CREATE POLICY "Sadece admin kimlik belgesini gorebilir"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'admin_belgeler_dogrulama'
    AND public.is_admin()
  );

-- ------------------------------------------------------------
-- 4. ÖRNEK ŞARTNAME ŞABLONLARI — HERKESE AÇIK (PUBLIC) STORAGE BUCKET
-- 4 kategori için birer .docx taslak barındırır (bkz. scratchpad'deki
-- tek seferlik yükleme script'i). Herkese açık olduğundan ekstra bir
-- SELECT politikası gerekmez (ihale-belgeleri ile aynı desen).
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('ornek-sartnameler', 'ornek-sartnameler', true)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 5. İHALELER — yayınlanma anından itibaren geri sayım + sonuç açıklama tarihi
--
-- sure_gun: kullanıcının formda seçtiği yayında kalma süresi (gün).
-- yayinlanma_tarihi: admin onayladığı an set edilir; NULL iken ihale
--   henüz "yayında" sayılmaz.
-- sonuc_aciklama_tarihi: bitis_tarihi + 21 gün, admin onayında hesaplanır.
-- ------------------------------------------------------------

ALTER TABLE public.ihaleler
  ADD COLUMN IF NOT EXISTS sure_gun              integer,
  ADD COLUMN IF NOT EXISTS yayinlanma_tarihi      timestamptz,
  ADD COLUMN IF NOT EXISTS sonuc_aciklama_tarihi  date;

-- ------------------------------------------------------------
-- 6. RLS — ihale açma / teklif verme yalnızca kimlik doğrulaması
-- onaylanmış GİRİŞLİ kullanıcılara açık. Misafir akışı (auth.uid() NULL)
-- bu kontrolün dışındadır -- misafirin zaten bir kullanicilar satırı yok.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Giris yapan ya da misafir ihale olusturabilir" ON public.ihaleler;
CREATE POLICY "Giris yapan ya da misafir ihale olusturabilir"
  ON public.ihaleler FOR INSERT WITH CHECK (
    (
      auth.uid() IS NOT NULL
      AND (olusturan_id IS NULL OR olusturan_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.kullanicilar
        WHERE id = auth.uid() AND kimlik_dogrulama_durumu = 'onaylandi'
      )
    )
    OR (auth.uid() IS NULL AND olusturan_id IS NULL)
  );

DROP POLICY IF EXISTS "Giris yapan teklif verebilir" ON public.teklifler;
CREATE POLICY "Giris yapan teklif verebilir"
  ON public.teklifler FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = kullanici_id
    AND auth.uid() IS DISTINCT FROM (SELECT olusturan_id FROM public.ihaleler WHERE id = ihale_id)
    AND EXISTS (
      SELECT 1 FROM public.kullanicilar
      WHERE id = auth.uid() AND kimlik_dogrulama_durumu = 'onaylandi'
    )
  );

-- ------------------------------------------------------------
-- 6b. REDDEDİLEN İHALEYİ DÜZENLEYİP TEKRAR GÖNDERME
--
-- ihale_kisitli_sutun_kontrol() tetikleyicisi, ihale sahibinin
-- inceleme_durumu/red_sebebi alanlarını DOĞRUDAN değiştirmesini
-- (admin incelemesini bypass etmesin diye) engelliyor -- bu yüzden
-- "Düzenle ve Tekrar Gönder" akışı, sahibin ihaleyi normal UPDATE ile
-- değil, bu SECURITY DEFINER RPC ile güncelleyip yeniden "beklemede"ye
-- almasını sağlar. Yalnızca GERÇEKTEN reddedilmiş VE kendi ihalesi olan
-- satırlarda çalışır -- aktif/onaylı bir ihaleyi bu yoldan tekrar
-- incelemeye düşürmek mümkün değildir.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ihale_kisitli_sutun_kontrol()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  admin_mi boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF current_setting('ihaletr.sistem_guncellemesi', true) = 'true' THEN
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

CREATE OR REPLACE FUNCTION public.ihale_duzenle_ve_tekrar_gonder(
  p_ihale_id         uuid,
  p_baslik           text,
  p_kategori         text,
  p_aciklama         text,
  p_kurum            text,
  p_ilce             text,
  p_mahalle          text,
  p_cadde_sokak      text,
  p_ada_no           text,
  p_parsel_no        text,
  p_mulkiyet_durumu  mulkiyet_durumu_tipi,
  p_sirket_unvani    text,
  p_yetkili_kisi_adi text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Giris yapmalisiniz.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ihaleler
    WHERE id = p_ihale_id AND olusturan_id = auth.uid() AND inceleme_durumu = 'reddedildi'
  ) THEN
    RAISE EXCEPTION 'Bu ihale size ait reddedilmis bir ihale degil.';
  END IF;

  PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);

  UPDATE public.ihaleler
  SET baslik = p_baslik, kategori = p_kategori, aciklama = p_aciklama, kurum = p_kurum,
      ilce = p_ilce, mahalle = p_mahalle, cadde_sokak = p_cadde_sokak,
      ada_no = p_ada_no, parsel_no = p_parsel_no, mulkiyet_durumu = p_mulkiyet_durumu,
      sirket_unvani = p_sirket_unvani, yetkili_kisi_adi = p_yetkili_kisi_adi,
      inceleme_durumu = 'beklemede', red_sebebi = NULL, durum = 'beklemede',
      updated_at = now()
  WHERE id = p_ihale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_duzenle_ve_tekrar_gonder(
  uuid, text, text, text, text, text, text, text, text, text, mulkiyet_durumu_tipi, text, text
) TO authenticated;

-- ------------------------------------------------------------
-- 7. "BEKLEMEDE" ROZETİ — KÖK SEBEP BACKFILL
-- Admin onaylayınca durum='aktif' yapan kod düzeltmesi bir önceki
-- düzeltme turunda yapıldı, ANCAK bu düzeltmeden ÖNCE onaylanmış
-- ihaleler hâlâ durum='beklemede' takılı kalmış olabilir. Onaylı
-- olup hâlâ beklemede görünen tüm ihaleleri tek seferlik düzeltir.
-- ------------------------------------------------------------

UPDATE public.ihaleler
SET durum = 'aktif', updated_at = now()
WHERE durum = 'beklemede' AND inceleme_durumu = 'onaylandi';

-- ------------------------------------------------------------
-- 8. REALTIME — ihaleler tablosunu yayına ekle (admin onayı/reddi
-- panel/listeleme sayfalarında canlı yansısın diye).
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ihaleler'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ihaleler;
  END IF;
END $$;
