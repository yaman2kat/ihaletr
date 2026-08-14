-- Teklif gizliligi sikilastirmasi:
-- 1) Ihale AKTIFKEN kimse (ihale sahibi dahil) teklif satirlarini
--    (kim ne kadar teklif verdi) goremez -- yalnizca SAYI herkese acik.
-- 2) Ihale BITINCE: sadece ihale sahibi tum teklifleri (firma adi +
--    tutar) gorebilir. Kurumsal plan kullanicilari SADECE tutarlari
--    (kimlik bilgisi olmadan) gorebilir.
-- Idempotent, tek "Run" ile guvenle calisir.

-- ------------------------------------------------------------
-- 1) teklifler SELECT politikasi: sahibi -> HER ZAMAN kendi teklifini;
--    ihale sahibi -> SADECE ihale bittiyse tum teklifleri.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Ihale sahibi ve teklif sahibi teklifleri gorebilir" ON public.teklifler;
CREATE POLICY "Teklif sahibi her zaman, ihale sahibi yalnizca ihale bitince gorebilir"
  ON public.teklifler FOR SELECT USING (
    auth.uid() = kullanici_id
    OR (
      auth.uid() = (SELECT olusturan_id FROM public.ihaleler WHERE id = ihale_id)
      AND EXISTS (
        SELECT 1 FROM public.ihaleler i WHERE i.id = ihale_id
          AND (i.durum = 'tamamlandi' OR (i.durum = 'aktif' AND i.bitis_tarihi < CURRENT_DATE))
      )
    )
  );

-- ------------------------------------------------------------
-- 2) Herkese acik teklif SAYISI -- kimlik/tutar icermez, RLS'i
--    SECURITY DEFINER ile bilinçli olarak atlar.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ihale_teklif_sayisi(p_ihale_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM public.teklifler WHERE ihale_id = p_ihale_id;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_teklif_sayisi(uuid) TO anon, authenticated;

-- Coklu ihale icin tek sorguda sayi (filtre/siralama sayfasinda "en cok
-- teklif alan" siralamasi ve panel listeleri icin -- N ayri RPC cagrisi
-- yerine).
CREATE OR REPLACE FUNCTION public.ihale_teklif_sayilari(p_ihale_idler uuid[])
RETURNS TABLE(ihale_id uuid, sayi integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.ihale_id, count(*)::integer AS sayi
  FROM public.teklifler t
  WHERE t.ihale_id = ANY(p_ihale_idler)
  GROUP BY t.ihale_id;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_teklif_sayilari(uuid[]) TO anon, authenticated;

-- ------------------------------------------------------------
-- 3) Kurumsal plan icin "sadece fiyat" erisimi -- kullanici_id/firma
--    adi asla dondurulmez, deanonimlestirme imkansiz. Yalnizca ihale
--    bittiyse ve caginin plan_turu='kurumsal' ise satir doner.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ihale_teklif_fiyatlari(p_ihale_id uuid)
RETURNS TABLE(tutar numeric) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bitmis boolean;
  v_plan   text;
BEGIN
  SELECT (durum = 'tamamlandi' OR (durum = 'aktif' AND bitis_tarihi < CURRENT_DATE))
    INTO v_bitmis FROM public.ihaleler WHERE id = p_ihale_id;
  IF NOT COALESCE(v_bitmis, false) THEN
    RETURN;
  END IF;

  SELECT k.plan_turu INTO v_plan FROM public.kullanicilar k WHERE k.id = auth.uid();
  IF v_plan IS DISTINCT FROM 'kurumsal' THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT t.tutar FROM public.teklifler t WHERE t.ihale_id = p_ihale_id ORDER BY t.tutar ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_teklif_fiyatlari(uuid) TO anon, authenticated;

-- DOGRULAMA
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teklifler' AND cmd = 'SELECT';
SELECT proname FROM pg_proc WHERE proname IN ('ihale_teklif_sayisi', 'ihale_teklif_fiyatlari');
