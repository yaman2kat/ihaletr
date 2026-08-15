-- Ihale sonuc raporunda kazanan fiyat bilgisi + firma ismi maskeleme:
-- 1) isim_maskele(): "Yilmaz Insaat A.S." -> "Y***** I***** A.S." (sirket
--    kisaltmalari oldugu gibi kalir).
-- 2) ihale_kazanan_fiyat(): kazanan tekliflin tutari -- SADECE ihale
--    sahibine, o ihaleye teklif vermis katilimcilara ve Kurumsal plan
--    sahiplerine; kazanan secilmemisse veya yetkisizse hicbir satir
--    donmez.
-- 3) ihale_kazanan_var_mi(): kimlik icermeyen, herkese acik "kazanan
--    secildi mi" booleani (kilitli goruntude CTA gosterip gostermeme
--    karari icin -- WHO kazandigini degil, SADECE karar verildi mi
--    bilgisini tasir).
-- 4) ihale_teklif_listesi_maskeli(): katilimcilar ve Kurumsal plan
--    sahipleri icin, kullanici_id/muteahhit_id ASLA donmeyen, isimleri
--    maskelenmis tam teklif listesi.
-- Idempotent, tek "Run" ile guvenle calisir.

CREATE OR REPLACE FUNCTION public.isim_maskele(p_isim text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_kelimeler text[];
  v_sonuc     text[] := '{}';
  v_kelime    text;
  v_sade      text;
  v_ekler     text[] := ARRAY['as','aş','ltd','şti','tic','san','inc','corp','co','llc','ve'];
BEGIN
  IF p_isim IS NULL OR trim(p_isim) = '' THEN RETURN p_isim; END IF;

  v_kelimeler := regexp_split_to_array(trim(p_isim), '\s+');
  FOREACH v_kelime IN ARRAY v_kelimeler LOOP
    v_sade := lower(regexp_replace(v_kelime, '[^0-9A-Za-zçğıöşüÇĞİÖŞÜ]', '', 'g'));
    IF v_sade = ANY(v_ekler) THEN
      v_sonuc := array_append(v_sonuc, v_kelime);
    ELSE
      v_sonuc := array_append(v_sonuc, left(v_kelime, 1) || repeat('*', greatest(0, length(v_kelime) - 1)));
    END IF;
  END LOOP;

  RETURN array_to_string(v_sonuc, ' ');
END;
$$;

CREATE OR REPLACE FUNCTION public.ihale_kazanan_fiyat(p_ihale_id uuid)
RETURNS TABLE(tutar numeric) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_secilen uuid;
  v_sahip   uuid;
  v_izinli  boolean := false;
BEGIN
  SELECT secilen_firma_id, olusturan_id INTO v_secilen, v_sahip FROM public.ihaleler WHERE id = p_ihale_id;
  IF v_secilen IS NULL THEN RETURN; END IF;

  IF auth.uid() IS NOT NULL THEN
    IF auth.uid() = v_sahip THEN v_izinli := true; END IF;
    IF NOT v_izinli AND EXISTS (SELECT 1 FROM public.teklifler WHERE ihale_id = p_ihale_id AND kullanici_id = auth.uid()) THEN
      v_izinli := true;
    END IF;
    IF NOT v_izinli AND EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = auth.uid() AND plan_turu = 'kurumsal') THEN
      v_izinli := true;
    END IF;
  END IF;
  IF NOT v_izinli THEN RETURN; END IF;

  RETURN QUERY SELECT t.tutar FROM public.teklifler t WHERE t.ihale_id = p_ihale_id AND t.kullanici_id = v_secilen;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_kazanan_fiyat(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ihale_kazanan_var_mi(p_ihale_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT secilen_firma_id IS NOT NULL FROM public.ihaleler WHERE id = p_ihale_id;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_kazanan_var_mi(uuid) TO anon, authenticated;

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
    public.isim_maskele(COALESCE(NULLIF(ku.firma_adi, ''), ku.ad_soyad, 'Kullanıcı')),
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

GRANT EXECUTE ON FUNCTION public.ihale_teklif_listesi_maskeli(uuid) TO anon, authenticated;

-- DOGRULAMA
SELECT public.isim_maskele('Yılmaz İnşaat A.Ş.') AS ornek_maskeleme;
SELECT proname FROM pg_proc WHERE proname IN (
  'isim_maskele', 'ihale_kazanan_fiyat', 'ihale_kazanan_var_mi', 'ihale_teklif_listesi_maskeli'
);
