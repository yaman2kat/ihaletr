-- ============================================================
-- Admin onay aksiyonu artık istemcide (tarayıcıda) hesaplanan
-- tarihler yerine, veritabanı seviyesinde NOW() ve interval
-- aritmetiğiyle çalışan bir RPC üzerinden yürütülür.
--
-- Neden: Önceki uygulamada yayinlanma_tarihi/bitis_tarihi istemci
-- tarafında `new Date()` ile hesaplanıp UPDATE'e öyle gönderiliyordu.
-- Bu, admin'in tarayıcı saati/saat dilimi ile veritabanı arasında
-- tutarsızlığa (clock drift) açık ve tekrarlanabilir bir hesaplama
-- değildi. Bu RPC, "geri sayım admin onayı ANINDA (NOW()) başlar,
-- bitiş = NOW() + seçilen gün sayısı" kuralını tek, yetkili bir
-- yerde (veritabanında) uygular.
--
-- Supabase Dashboard > SQL Editor'a yapıştırıp çalıştırın.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ihale_onayla(p_ihale_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sure_gun integer;
  v_durum    ihale_durumu;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Bu islem icin admin yetkisi gereklidir.';
  END IF;

  SELECT sure_gun, durum INTO v_sure_gun, v_durum
  FROM public.ihaleler
  WHERE id = p_ihale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ihale bulunamadi.';
  END IF;

  UPDATE public.ihaleler
  SET inceleme_durumu = 'onaylandi',
      red_sebebi = NULL,
      yayinlanma_tarihi = NOW(),
      bitis_tarihi = (NOW() + (COALESCE(v_sure_gun, 30) || ' days')::interval)::date,
      sonuc_aciklama_tarihi = (NOW() + (COALESCE(v_sure_gun, 30) || ' days')::interval + interval '21 days')::date,
      -- Yalnizca hala 'beklemede' olan (ilk kez ya da tekrar gonderilmis)
      -- bir ihale 'aktif'e gecer; zaten aktif/tamamlandi/iptal olan bir
      -- ihalenin durumu bu RPC ile degistirilmez.
      durum = CASE WHEN v_durum = 'beklemede' THEN 'aktif' ELSE v_durum END,
      updated_at = now()
  WHERE id = p_ihale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_onayla(uuid) TO authenticated;
