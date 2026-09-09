-- ============================================================
-- İhaleTR — İhale kategorisine göre farklı teklif verme sistemi
-- Supabase Dashboard > SQL Editor > New Query'e yapıştırıp çalıştırın.
-- Idempotent: birden fazla kez çalıştırılabilir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) teklifler tablosu: dosya tabanlı teklif desteği
--    - teklif_turu: 'nakit' (mevcut TL teklif) | 'dosya' (Kat Karşılığı /
--      Kentsel Dönüşüm ihalelerinde net rakam yerine yüklenen teklif
--      dosyası)
--    - teklif_dosyasi_url / alternatif_proje_url: private
--      "ihale-teklif-dosyalari" bucket'i icindeki OBJE YOLU (public URL
--      DEĞİL — bkz. asagidaki bucket/RLS).
--    - tutar artik NOT NULL degil (dosya turu tekliflerde bos kalir);
--      hangi turde hangi alanin ZORUNLU oldugu asagidaki CHECK ile
--      veritabani seviyesinde garanti edilir.
-- ------------------------------------------------------------

ALTER TABLE public.teklifler
  ADD COLUMN IF NOT EXISTS teklif_turu          text NOT NULL DEFAULT 'nakit',
  ADD COLUMN IF NOT EXISTS teklif_dosyasi_url    text,
  ADD COLUMN IF NOT EXISTS alternatif_proje_url  text;

ALTER TABLE public.teklifler ALTER COLUMN tutar DROP NOT NULL;

ALTER TABLE public.teklifler DROP CONSTRAINT IF EXISTS teklifler_teklif_turu_check;
ALTER TABLE public.teklifler ADD CONSTRAINT teklifler_teklif_turu_check
  CHECK (teklif_turu IN ('nakit', 'dosya'));

-- nakit teklifte tutar zorunlu; dosya teklifte teklif dosyasi zorunlu
-- (alternatif_proje_url her iki turde de hep opsiyoneldir).
ALTER TABLE public.teklifler DROP CONSTRAINT IF EXISTS teklifler_turu_veri_tutarli;
ALTER TABLE public.teklifler ADD CONSTRAINT teklifler_turu_veri_tutarli
  CHECK (
    (teklif_turu = 'nakit' AND tutar IS NOT NULL)
    OR (teklif_turu = 'dosya' AND teklif_dosyasi_url IS NOT NULL)
  );

-- ------------------------------------------------------------
-- 2) "ihale-teklif-dosyalari" — ÖZEL (private) bucket. "ihale-belgeleri"
--    bucket'i public=true'dur ve objelerine herkese açık URL ile (RLS
--    hiç devreye girmeden) erişilebilir; bu yüzden teklif dosyaları için
--    KASITLI OLARAK kullanılmadı — aksi halde "ihale süresi boyunca hiç
--    kimse göremez" şartı sağlanamazdı. Bunun yerine "ihale-tapu-belgeleri"
--    ile aynı özel bucket deseni izlenir.
--
--    Obje yolu: {ihale_id}/{kullanici_id}/{dosya-turu}-...  Bu sayede:
--    - INSERT politikasi sadece "kendi klasorune" yazmaya izin verir.
--    - SELECT politikasi teklifler/ihaleler ile JOIN ederek ihale
--      bitene kadar KİMSEYE (yükleyen dahil — mevcut teklif tutarı
--      gizliliğiyle aynı felsefe) acmaz; bittikten sonra yalnizca ihale
--      sahibi, o ihaleye teklif vermis katilimcilar (kendi dosyalari
--      dahil) ve Kurumsal plan sahiplerine acar — ihale_teklif_listesi_
--      maskeli() ile ayni yetki kurali.
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('ihale-teklif-dosyalari', 'ihale-teklif-dosyalari', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Giris yapan kendi teklif dosyasini yukleyebilir" ON storage.objects;
CREATE POLICY "Giris yapan kendi teklif dosyasini yukleyebilir"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'ihale-teklif-dosyalari'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Teklif dosyasi sadece ihale bitince yetkiliye acik" ON storage.objects;
CREATE POLICY "Teklif dosyasi sadece ihale bitince yetkiliye acik"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'ihale-teklif-dosyalari'
    AND EXISTS (
      SELECT 1 FROM public.ihaleler i
      WHERE i.id::text = (storage.foldername(name))[1]
        AND (i.durum = 'tamamlandi' OR (i.durum = 'aktif' AND i.bitis_tarihi < CURRENT_DATE))
        AND (
          i.olusturan_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.teklifler t WHERE t.ihale_id = i.id AND t.kullanici_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.kullanicilar k WHERE k.id = auth.uid() AND k.plan_turu = 'kurumsal')
        )
    )
  );

-- ------------------------------------------------------------
-- 3) ihale_teklif_listesi_maskeli(): dosya alanlarini da dondurur +
--    kazandi_mi (dosya turu tekliflerde tutar eslesmesiyle kazanani
--    bulmak imkansiz oldugundan, kullanici_id hic donmeden sunucu
--    tarafinda hesaplanmis bir "kazandi mi" bayragi eklendi). Donen
--    sutun listesi degistigi icin once DROP gerekir.
-- ------------------------------------------------------------

DROP FUNCTION IF EXISTS public.ihale_teklif_listesi_maskeli(uuid);

CREATE FUNCTION public.ihale_teklif_listesi_maskeli(p_ihale_id uuid)
RETURNS TABLE(
  isim_maskeli text, tutar numeric, ortalama_puan numeric, yorum_sayisi integer,
  teklif_turu text, teklif_dosyasi_url text, alternatif_proje_url text, kazandi_mi boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bitmis      boolean;
  v_izinli      boolean := false;
  v_secilen     uuid;
BEGIN
  SELECT (durum = 'tamamlandi' OR (durum = 'aktif' AND bitis_tarihi < CURRENT_DATE)), secilen_firma_id
    INTO v_bitmis, v_secilen FROM public.ihaleler WHERE id = p_ihale_id;
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
    COALESCE(y.yorum_sayisi, 0)::integer,
    t.teklif_turu,
    t.teklif_dosyasi_url,
    t.alternatif_proje_url,
    (v_secilen IS NOT NULL AND t.kullanici_id = v_secilen)
  FROM public.teklifler t
  JOIN public.kullanicilar ku ON ku.id = t.kullanici_id
  LEFT JOIN (
    SELECT muteahhit_id, AVG(puan) AS ortalama_puan, COUNT(*) AS yorum_sayisi
    FROM public.muteahhit_yorumlar GROUP BY muteahhit_id
  ) y ON y.muteahhit_id = t.kullanici_id
  WHERE t.ihale_id = p_ihale_id
  ORDER BY t.tutar ASC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_teklif_listesi_maskeli(uuid) TO anon, authenticated;

-- DOGRULAMA
SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'teklifler'
  AND column_name IN ('teklif_turu', 'teklif_dosyasi_url', 'alternatif_proje_url');
SELECT id, public FROM storage.buckets WHERE id = 'ihale-teklif-dosyalari';
SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname IN ('Giris yapan kendi teklif dosyasini yukleyebilir', 'Teklif dosyasi sadece ihale bitince yetkiliye acik');
SELECT proname FROM pg_proc WHERE proname = 'ihale_teklif_listesi_maskeli';
