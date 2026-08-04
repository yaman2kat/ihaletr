-- ihaleler: add missing columns (idempotent)

ALTER TABLE public.ihaleler ADD COLUMN IF NOT EXISTS mahalle text;
ALTER TABLE public.ihaleler ADD COLUMN IF NOT EXISTS yuzolcumu_m2 numeric;
ALTER TABLE public.ihaleler ADD COLUMN IF NOT EXISTS yapi_insaat_ruhsati text;
ALTER TABLE public.ihaleler ADD COLUMN IF NOT EXISTS proje text;
ALTER TABLE public.ihaleler ADD COLUMN IF NOT EXISTS goruntulenme_sayisi integer NOT NULL DEFAULT 0;

ALTER TABLE public.ihaleler DROP CONSTRAINT IF EXISTS yapi_insaat_ruhsati_gecerli;
ALTER TABLE public.ihaleler ADD CONSTRAINT yapi_insaat_ruhsati_gecerli CHECK (yapi_insaat_ruhsati IS NULL OR yapi_insaat_ruhsati IN ('var', 'yok'));

ALTER TABLE public.ihaleler DROP CONSTRAINT IF EXISTS proje_gecerli;
ALTER TABLE public.ihaleler ADD CONSTRAINT proje_gecerli CHECK (proje IS NULL OR proje IN ('var', 'yok'));

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ihaleler'
  AND column_name IN ('mahalle', 'yuzolcumu_m2', 'yapi_insaat_ruhsati', 'proje', 'goruntulenme_sayisi')
ORDER BY column_name;
