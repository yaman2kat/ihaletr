-- Ihale olusturma formunda tasinmaz konum bilgilerini tamamlamak icin
-- (il/ilce/mahalle zaten vardi) cadde/sokak alani eklenir. Yeni ihalelerde
-- form tarafinda zorunlu tutulur; sutun nullable'dir ki mevcut kayitlar
-- bozulmasin.
-- Idempotent, tek "Run" ile guvenle calisir.

ALTER TABLE public.ihaleler
  ADD COLUMN IF NOT EXISTS cadde_sokak text;

-- DOGRULAMA
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ihaleler' AND column_name = 'cadde_sokak';
