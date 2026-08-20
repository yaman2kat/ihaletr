-- 1) Muteahhit profiline "web sitesi" alani eklenir. Erisim kontrolu
--    icin ayrica bir sey gerekmez: muteahhit_profil_gizlilik_migration.sql
--    ile kurulan SELECT politikasi zaten SATIR bazli calisir (sahibi,
--    admin, ya da bu muteahhide BITMIS bir ihalede teklif vermis arsa
--    sahibi) -- bu yeni sutun da ayni satirin bir parcasi oldugundan
--    otomatik olarak ayni kurala tabi olur. (Not: "kazanan secilmis
--    olma" sarti UI katmaninda application-level bir asiri kisitlamaydi;
--    kaldirildi -- teklif veren HER muteahhit artik ihale bittiginde
--    kalici olarak tam profile erisim acar.)
--
-- 2) Ihale sonuc raporunda rakip teklif listesi: katilimcilar (bu
--    ihaleye teklif vermis olanlar) artik KENDI satirlarinda gercek
--    firma adini gorur, digerlerinde isim maskeli kalir. Fonksiyon
--    imzasi (donen sutunlar) degismedi, sadece isim secimi auth.uid()
--    ile kosullandi -- CREATE OR REPLACE yeterli.
-- Idempotent, tek "Run" ile guvenle calisir.

ALTER TABLE public.muteahhit_profiller ADD COLUMN IF NOT EXISTS web_sitesi text;

CREATE OR REPLACE FUNCTION public.ihale_teklif_listesi_maskeli(p_ihale_id uuid)
RETURNS TABLE(isim_maskeli text, tutar numeric, ortalama_puan numeric, yorum_sayisi integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bitmis boolean;
  v_izinli boolean := false;
BEGIN
  SELECT (durum = 'tamamlandi' OR (durum = 'aktif' AND bitis_tarihi < CURRENT_DATE))
    INTO v_bitmis FROM public.ihaleler WHERE id = p_ihale_id;
  IF NOT COALESCE(v_bitmis, false) THEN RETURN; END IF;

  IF auth.uid() IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.teklifler WHERE ihale_id = p_ihale_id AND kullanici_id = auth.uid()) THEN
      v_izinli := true;
    END IF;
    IF NOT v_izinli AND EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND plan_turu = 'kurumsal') THEN
      v_izinli := true;
    END IF;
  END IF;
  IF NOT v_izinli THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    CASE WHEN t.kullanici_id = auth.uid()
      THEN COALESCE(NULLIF(ku.firma_adi, ''), ku.ad_soyad, 'Kullanıcı')
      ELSE public.isim_maskele(COALESCE(NULLIF(ku.firma_adi, ''), ku.ad_soyad, 'Kullanıcı'))
    END,
    t.tutar,
    y.ortalama_puan,
    COALESCE(y.yorum_sayisi, 0)::integer
  FROM public.teklifler t
  JOIN public.kullanicilar ku ON ku.id = t.kullanici_id
  LEFT JOIN (
    SELECT muteahhit_id, AVG(puan) AS ortalama_puan, COUNT(*) AS yorum_sayisi
    FROM public.muteahhit_yorumlar GROUP BY muteahhit_id
  ) y ON y.muteahhit_id = t.kullanici_id
  WHERE t.ihale_id = p_ihale_id
  ORDER BY t.tutar ASC;
END;
$$;

-- DOGRULAMA
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'muteahhit_profiller' AND column_name = 'web_sitesi';
SELECT proname FROM pg_proc WHERE proname = 'ihale_teklif_listesi_maskeli';
