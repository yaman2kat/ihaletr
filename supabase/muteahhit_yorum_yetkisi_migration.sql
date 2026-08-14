-- Muteahhit yorumlari: bir muteahhide yalnizca onunla bir ihale
-- uzerinden GERCEKTEN calismis (teklifi kabul edilmis) kisiler yorum
-- yazabilsin. Bu kurali anlamli kilmak icin, ihale sahibinin bitmis bir
-- ihalede bir teklifi "kazandi" olarak isaretleyebilecegi (durum =
-- kabul_edildi) bir UPDATE yolu da eklenir -- daha once boyle bir yol
-- yoktu, hicbir teklif hicbir zaman kabul_edildi durumuna gecemiyordu.
-- Idempotent, tek "Run" ile guvenle calisir.

-- ------------------------------------------------------------
-- 1) Ihale sahibi, BITMIS kendi ihalesindeki bir teklifi
--    kabul_edildi/reddedildi olarak isaretleyebilir. Tutar/kullanici_id
--    gibi alanlar degistirilemez (trigger ile kisitlanir).
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Ihale sahibi bitmis ihalede teklif durumunu guncelleyebilir" ON public.teklifler;
CREATE POLICY "Ihale sahibi bitmis ihalede teklif durumunu guncelleyebilir"
  ON public.teklifler FOR UPDATE USING (
    auth.uid() = (SELECT olusturan_id FROM public.ihaleler WHERE id = ihale_id)
    AND EXISTS (
      SELECT 1 FROM public.ihaleler i WHERE i.id = ihale_id
        AND (i.durum = 'tamamlandi' OR (i.durum = 'aktif' AND i.bitis_tarihi < CURRENT_DATE))
    )
  ) WITH CHECK (
    auth.uid() = (SELECT olusturan_id FROM public.ihaleler WHERE id = ihale_id)
  );

CREATE OR REPLACE FUNCTION public.teklif_kisitli_sutun_kontrol()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tutar IS DISTINCT FROM OLD.tutar
     OR NEW.kullanici_id IS DISTINCT FROM OLD.kullanici_id
     OR NEW.ihale_id IS DISTINCT FROM OLD.ihale_id
     OR NEW.aciklama IS DISTINCT FROM OLD.aciklama
  THEN
    RAISE EXCEPTION 'KISITLI_ALAN_DEGISTIRILEMEZ: Yalnizca durum alani degistirilebilir.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teklif_kisitli_sutun_kontrol ON public.teklifler;
CREATE TRIGGER trg_teklif_kisitli_sutun_kontrol
  BEFORE UPDATE ON public.teklifler
  FOR EACH ROW EXECUTE FUNCTION public.teklif_kisitli_sutun_kontrol();

-- ------------------------------------------------------------
-- 2) Yorum yazma yetkisi: yalnizca bu muteahhitle en az bir ihalede
--    birlikte calismis (teklifi o ihalenin sahibi tarafindan kabul
--    edilmis) kullanicilar.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Giris yapan muteahhite yorum ekleyebilir" ON public.muteahhit_yorumlar;
DROP POLICY IF EXISTS "Sadece birlikte calisilan muteahhite yorum eklenebilir" ON public.muteahhit_yorumlar;
CREATE POLICY "Sadece birlikte calisilan muteahhite yorum eklenebilir"
  ON public.muteahhit_yorumlar FOR INSERT WITH CHECK (
    auth.uid() = kullanici_id
    AND muteahhit_id <> kullanici_id
    AND EXISTS (
      SELECT 1 FROM public.teklifler t
      JOIN public.ihaleler i ON i.id = t.ihale_id
      WHERE t.kullanici_id = muteahhit_id
        AND t.durum = 'kabul_edildi'
        AND i.olusturan_id = auth.uid()
    )
  );

-- DOGRULAMA
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teklifler' AND cmd = 'UPDATE';
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'muteahhit_yorumlar' AND cmd = 'INSERT';
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_teklif_kisitli_sutun_kontrol';
