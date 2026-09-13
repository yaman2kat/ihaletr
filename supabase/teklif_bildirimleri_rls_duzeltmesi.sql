-- ============================================================
-- DÜZELTME — teklif_bildirimleri INSERT RLS politikası, GERÇEK ihale
-- sahibini bile reddediyordu.
--
-- Kök sebep: politikanın ikinci EXISTS koşulu
-- ("... AND ihale_id = teklif_bildirimleri.ihale_id") hem
-- "teklifler" hem "teklif_bildirimleri" tablosunda AYNI ADDA
-- ("ihale_id") bir sütun olduğu için, tabloyu kendi gerçek adıyla
-- (teklif_bildirimleri.ihale_id) niteleyerek eklenen satırın değerine
-- referans verme denemesi güvenilir şekilde çalışmadı (canlı testte
-- gerçek ihale sahibi için bile RLS ihlali olarak doğrulandı).
--
-- Çözüm: aynı ada sahip sütun çakışmasından tamamen kaçınan, skaler
-- alt sorgu deseni (belgeler tablosundaki INSERT politikasıyla aynı,
-- kanıtlanmış çalışan desen).
-- ============================================================

DROP POLICY IF EXISTS "Ihale sahibi kendi ihalesi icin teklif bildirebilir" ON public.teklif_bildirimleri;
CREATE POLICY "Ihale sahibi kendi ihalesi icin teklif bildirebilir"
  ON public.teklif_bildirimleri FOR INSERT WITH CHECK (
    auth.uid() = bildiren_id
    AND EXISTS (
      SELECT 1 FROM public.ihaleler WHERE id = ihale_id AND olusturan_id = auth.uid()
    )
    AND (SELECT ihale_id FROM public.teklifler WHERE id = teklif_id) = ihale_id
  );
