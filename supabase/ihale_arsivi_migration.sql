-- Ihale Arsivi sistemi migration'i.
-- ONKOSUL: pg_cron extension'i ONCE Dashboard'dan aktif edilmis olmali
-- (otomatik_sonlandirma_migration.sql'de zaten aktif edilmis olmasi
-- gerekir -- degilse "schema cron does not exist" hatasi alirsiniz).
-- Idempotent, tek "Run" ile guvenle calisir.

-- 1) ihale_durumu enum'una 'arsiv' degeri eklenir. Yeni enum degeri ayni
-- transaction icinde asagida (fonksiyon govdesinde literal olarak degil,
-- UPDATE/CAST ile) kullanilacagi icin araya COMMIT konur (bkz.
-- mulkiyet_dogrulama_migration.sql'deki ayni duzeltme).
ALTER TYPE ihale_durumu ADD VALUE IF NOT EXISTS 'arsiv';
COMMIT;

-- 2) Kazananin SECILDIGI tarihi (ihaleler.updated_at'ten BAGIMSIZ,
-- cunku updated_at goruntulenme sayaci gibi alakasiz guncellemelerde de
-- degisiyor -- bkz. goruntulenme_sayaci_migration.sql) ayri bir sutunda
-- tutar; 30 gunluk arsivleme sayaci bu sutuna gore isler.
ALTER TABLE public.ihaleler
  ADD COLUMN IF NOT EXISTS kazanan_secim_tarihi timestamptz;

-- 3) ihale_kapatildi_bildir() tetikleyicisi zaten secilen_firma_id ilk
-- kez atandiginda calisiyordu (bkz. ihale_kapatma_migration.sql) --
-- ayni kosulda artik kazanan_secim_tarihi'ni de damgalar. AFTER UPDATE
-- oldugu icin NEW uzerinden degil, ayrica bir UPDATE ile yazilir; bu
-- ikinci UPDATE tetikleyiciyi tekrar tetikler ama
-- "secilen_firma_id degismedi" kontrolunden erken doner (sonsuz donguye
-- girmez).
CREATE OR REPLACE FUNCTION public.ihale_kapatildi_bildir()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kaybeden RECORD;
BEGIN
  IF NEW.secilen_firma_id IS NULL OR NEW.secilen_firma_id IS NOT DISTINCT FROM OLD.secilen_firma_id THEN
    RETURN NEW;
  END IF;

  UPDATE public.ihaleler SET kazanan_secim_tarihi = now()
    WHERE id = NEW.id AND kazanan_secim_tarihi IS NULL;

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

-- 4) Arsivleme fonksiyonu: kazanani secilmis (secilen_firma_id dolu),
-- "tamamlandi" durumundaki ve kazanan_secim_tarihi uzerinden 30 gunden
-- fazla zaman gecmis ihaleleri "arsiv" durumuna tasir. Kazanan hic
-- secilmemis (surekli "tamamlandi" kalan) ihaleler kasitli olarak
-- arsivlenmez.
CREATE OR REPLACE FUNCTION public.ihale_arsivle()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ihaleler
  SET durum = 'arsiv'
  WHERE durum = 'tamamlandi'
    AND secilen_firma_id IS NOT NULL
    AND kazanan_secim_tarihi IS NOT NULL
    AND kazanan_secim_tarihi < (now() - interval '30 days');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ihale_arsivle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ihale_arsivle() TO service_role;

-- 5) Gunde bir kez (gece 03:00) calistiracak zamanlanmis is. Zaten
-- planlanmissa tekrar eklemez (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ihale-arsivle') THEN
    PERFORM cron.schedule('ihale-arsivle', '0 3 * * *', 'SELECT public.ihale_arsivle();');
  END IF;
END $$;

-- 6) Tutar maskeleme: isim_maskele() (bkz. ihale_kazanan_gizliligi_migration.sql)
-- ile ayni mantik -- ilk 2 rakam gorunur kalir, gerisi '•' ile
-- maskelenir (binlik ayiraclari korunur). Arsiv sayfasinda teklif
-- tutarlari firma isimleriyle birlikte maskeli gosterilir.
CREATE OR REPLACE FUNCTION public.tutar_maskele(p_tutar numeric)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_tam     text;
  v_sonuc   text := '';
  v_rakam_i int  := 0;
  c         text;
BEGIN
  IF p_tutar IS NULL THEN RETURN NULL; END IF;

  v_tam := replace(trim(to_char(round(p_tutar), 'FM999,999,999,999')), ',', '.');

  FOR i IN 1..length(v_tam) LOOP
    c := substr(v_tam, i, 1);
    IF c ~ '[0-9]' THEN
      v_rakam_i := v_rakam_i + 1;
      v_sonuc := v_sonuc || (CASE WHEN v_rakam_i <= 2 THEN c ELSE '•' END);
    ELSE
      v_sonuc := v_sonuc || c;
    END IF;
  END LOOP;

  RETURN v_sonuc || ' ₺';
END;
$$;

-- 7) Arsiv detayinda gosterilecek, ISIM VE TUTARI BIRLIKTE maskeleyen
-- teklif listesi -- ihale_teklif_listesi_maskeli()'den (bkz.
-- ihale_kazanan_gizliligi_migration.sql) farkli olarak burada tutar da
-- maskelenir ve erisim YALNIZCA Kurumsal plan sahipleriyle sinirlidir
-- (arsiv sayfasi zaten yalnizca Kurumsal kullanicilara acik).
CREATE OR REPLACE FUNCTION public.ihale_arsiv_teklif_listesi_maskeli(p_ihale_id uuid)
RETURNS TABLE(isim_maskeli text, tutar_maskeli text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_izinli boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT (plan_turu = 'kurumsal') INTO v_izinli FROM public.kullanicilar WHERE id = auth.uid();
  END IF;
  IF NOT COALESCE(v_izinli, false) THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    public.isim_maskele(COALESCE(NULLIF(ku.firma_adi, ''), ku.ad_soyad, 'Kullanıcı')),
    public.tutar_maskele(t.tutar)
  FROM public.teklifler t
  JOIN public.kullanicilar ku ON ku.id = t.kullanici_id
  WHERE t.ihale_id = p_ihale_id
  ORDER BY t.tutar ASC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_arsiv_teklif_listesi_maskeli(uuid) TO authenticated;

-- DOGRULAMA
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'ihale_durumu'::regtype ORDER BY enumsortorder;
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ihaleler' AND column_name = 'kazanan_secim_tarihi';
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'ihale-arsivle';
SELECT proname FROM pg_proc WHERE proname IN ('ihale_arsivle', 'tutar_maskele', 'ihale_arsiv_teklif_listesi_maskeli');
