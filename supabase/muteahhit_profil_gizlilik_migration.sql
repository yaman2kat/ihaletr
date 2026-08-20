-- Muteahhit profil gizliligi:
-- 1) Muteahhit profil sayfasi (/muteahhit/[id]) artik herkese acik degil.
--    Sadece: profilin sahibi, admin, ve o muteahhidin teklif verdigi
--    (BITMIS) bir ihalenin sahibi olan arsa sahipleri gorebilir.
--    Ayni kisit, sayfayla birlikte sizan referans projeler ve yorumlar
--    tablolarina da (dogrudan REST/PostgREST erisimini de kapatmak icin)
--    uygulanir.
-- 2) Iletisim bilgileri (telefon, email): daha da siki bir kosul --
--    yalnizca o muteahhitle ihale uzerinden GERCEKTEN bulusmus (ihale
--    bitmis VE kazanan olarak SECILMIS) arsa sahiplerine, sahibine ve
--    admine gorunur. Bu kisit uygulama katmaninda (page.tsx) kontrol
--    edilir; asagidaki RPC bu kontrolu yapar.
-- 3) Yorum yazma yetkisi zaten muteahhit_yorum_yetkisi_migration.sql ile
--    dogru sekilde kisitlanmis durumda (teklifi kabul_edilmis olanlar) --
--    burada degisiklik yok.
-- Idempotent, tek "Run" ile guvenle calisir.

-- ------------------------------------------------------------
-- 1) Bir arsa sahibinin bu muteahhitle "bulustu" sayilmasi icin: bu
--    muteahhidin, arsa sahibinin BITMIS bir ihalesine teklif vermis
--    olmasi yeterli (kazanan secilmis olmasi sart degil).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.muteahhit_ile_bulusmus_mu(p_muteahhit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teklifler t
    JOIN public.ihaleler i ON i.id = t.ihale_id
    WHERE t.kullanici_id = p_muteahhit_id
      AND i.olusturan_id = auth.uid()
      AND (i.durum = 'tamamlandi' OR (i.durum = 'aktif' AND i.bitis_tarihi < CURRENT_DATE))
  );
$$;

GRANT EXECUTE ON FUNCTION public.muteahhit_ile_bulusmus_mu(uuid) TO anon, authenticated;

-- ------------------------------------------------------------
-- 2) Iletisim bilgisi gorunurlugu icin daha siki kosul: BITMIS ihalede
--    bu muteahhit KAZANAN olarak secilmis olmali (secilen_firma_id).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.muteahhit_ile_kazanan_olarak_bulusmus_mu(p_muteahhit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ihaleler i
    WHERE i.olusturan_id = auth.uid()
      AND i.secilen_firma_id = p_muteahhit_id
      AND (i.durum = 'tamamlandi' OR (i.durum = 'aktif' AND i.bitis_tarihi < CURRENT_DATE))
  );
$$;

GRANT EXECUTE ON FUNCTION public.muteahhit_ile_kazanan_olarak_bulusmus_mu(uuid) TO anon, authenticated;

-- ------------------------------------------------------------
-- 3) Profil VAR MI kontrolu -- RLS'i bilincli olarak atlar. Sayfanin
--    404 (profil hic yok) ile 403 (profil var, erisim yok) durumlarini
--    ayirt edebilmesi icin gerekli; kimlik/iletisim bilgisi dondurmez.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.muteahhit_profil_var_mi(p_muteahhit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.muteahhit_profiller WHERE kullanici_id = p_muteahhit_id);
$$;

GRANT EXECUTE ON FUNCTION public.muteahhit_profil_var_mi(uuid) TO anon, authenticated;

-- ------------------------------------------------------------
-- 4) muteahhit_profiller SELECT: herkese acik "true" kaldirildi.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Herkes muteahhit profillerini gorebilir" ON public.muteahhit_profiller;
CREATE POLICY "Sahibi, admin ve bulusmus arsa sahibi profili gorebilir"
  ON public.muteahhit_profiller FOR SELECT USING (
    auth.uid() = kullanici_id
    OR public.is_admin()
    OR public.muteahhit_ile_bulusmus_mu(kullanici_id)
  );

-- ------------------------------------------------------------
-- 5) muteahhit_referans_projeler / muteahhit_yorumlar SELECT: profil
--    sayfasi kapaliyken bu tablolar dogrudan sorgulanarak icerigin
--    sizmasini onlemek icin ayni kisit uygulanir. (Yorum EKLEME yetkisi
--    zaten ayrica kisitli -- burada sadece OKUMA degisiyor.)
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Herkes referans projeleri gorebilir" ON public.muteahhit_referans_projeler;
CREATE POLICY "Sahibi, admin ve bulusmus arsa sahibi referans projeleri gorebilir"
  ON public.muteahhit_referans_projeler FOR SELECT USING (
    auth.uid() = muteahhit_id
    OR public.is_admin()
    OR public.muteahhit_ile_bulusmus_mu(muteahhit_id)
  );

DROP POLICY IF EXISTS "Muteahhit yorumlari herkese acik" ON public.muteahhit_yorumlar;
CREATE POLICY "Sahibi, admin ve bulusmus arsa sahibi yorumlari gorebilir"
  ON public.muteahhit_yorumlar FOR SELECT USING (
    auth.uid() = muteahhit_id
    OR public.is_admin()
    OR public.muteahhit_ile_bulusmus_mu(muteahhit_id)
  );

-- DOGRULAMA
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'muteahhit_profiller' AND cmd = 'SELECT';
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'muteahhit_referans_projeler' AND cmd = 'SELECT';
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'muteahhit_yorumlar' AND cmd = 'SELECT';
SELECT proname FROM pg_proc WHERE proname IN (
  'muteahhit_ile_bulusmus_mu', 'muteahhit_ile_kazanan_olarak_bulusmus_mu', 'muteahhit_profil_var_mi'
);
