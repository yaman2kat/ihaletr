-- ============================================================
-- SIKILAŞTIRMA — ihale_suresini_uzat() RPC'si yalnızca durum='aktif'
-- kontrol ediyordu, bitis_tarihi'nin GERÇEKTEN geçip geçmediğine
-- bakmıyordu. otomatik_sonlandirma_migration.sql'deki pg_cron işi,
-- süresi dolmuş bir ihaleyi ancak 2 gün SONRA 'tamamlandi' yapıyor --
-- bu 2 günlük pencerede durum hâlâ 'aktif' olduğundan, RPC'ye
-- doğrudan (ör. tarayıcı konsolundan) çağrı yapan biri süresi zaten
-- dolmuş bir ihaleyi uzatabiliyordu. Bu, "ihale bittikten sonra
-- hiçbir şekilde uzatma yapılamaz" kuralını ihlal ediyordu.
--
-- UI zaten (SureEkleKart.tsx) yalnızca bitis_tarihi geçmemişken bu
-- butonu gösteriyor; bu migration aynı kuralı RPC'nin kendisinde de
-- (asıl güvenlik sınırı olarak) uygular.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ihale_suresini_uzat(
  p_ihale_id uuid,
  p_gun      integer
)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_havuz      integer;
  v_yeni_tarih date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Giris yapmalisiniz.';
  END IF;

  IF p_gun IS NULL OR p_gun <= 0 THEN
    RAISE EXCEPTION 'Gecerli bir gun sayisi girin.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ihaleler
    WHERE id = p_ihale_id
      AND olusturan_id = auth.uid()
      AND durum = 'aktif'
      AND bitis_tarihi >= CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'Bu ihale size ait aktif bir ihale degil ya da suresi zaten dolmus.';
  END IF;

  SELECT uzatma_havuzu_gun INTO v_havuz FROM public.kullanicilar WHERE id = auth.uid() FOR UPDATE;

  IF v_havuz IS NULL OR v_havuz < p_gun THEN
    RAISE EXCEPTION 'UZATMA_HAVUZU_YETERSIZ: Uzatma havuzunuzda yeterli gun yok.';
  END IF;

  PERFORM set_config('ihaletr.sistem_guncellemesi', 'true', true);

  UPDATE public.kullanicilar
  SET uzatma_havuzu_gun = uzatma_havuzu_gun - p_gun
  WHERE id = auth.uid();

  UPDATE public.ihaleler
  SET bitis_tarihi = bitis_tarihi + p_gun, updated_at = now()
  WHERE id = p_ihale_id
  RETURNING bitis_tarihi INTO v_yeni_tarih;

  RETURN v_yeni_tarih;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_suresini_uzat(uuid, integer) TO authenticated;
