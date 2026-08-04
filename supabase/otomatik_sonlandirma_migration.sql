-- Otomatik ihale sonlandirma (pg_cron) migration.
-- ONKOSUL: pg_cron extension'i ONCE Dashboard'dan aktif edilmis olmali
-- (asagidaki adimlara bakin). Extension aktif degilse "schema cron
-- does not exist" hatasi alirsiniz.
-- Idempotent, tek "Run" ile guvenle calisir.

-- 1) Otomatik sonlandirildi bilgisini tutan sutun
ALTER TABLE public.ihaleler ADD COLUMN IF NOT EXISTS otomatik_sonlandirildi boolean NOT NULL DEFAULT false;

-- 2) Sonlandirma fonksiyonu: suresi dolmus (bitis_tarihi 2 gunden
-- eski) VE hala "aktif" durumda olan (yani uzatilmamis, elle de
-- sonlandirilmamis) ihaleleri "tamamlandi" yapar.
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

-- 3) Gunde 4 kez (her 6 saatte bir) calistiracak zamanlanmis is.
-- Zaten planlanmissa tekrar eklemez (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ihale-otomatik-sonlandir') THEN
    PERFORM cron.schedule('ihale-otomatik-sonlandir', '0 */6 * * *', 'SELECT public.ihale_otomatik_sonlandir();');
  END IF;
END $$;

-- DOGRULAMA
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'ihale-otomatik-sonlandir';
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ihaleler' AND column_name = 'otomatik_sonlandirildi';
