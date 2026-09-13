-- ============================================================
-- DÜZELTME v2 — teklif_bildirimleri INSERT politikası ilk düzeltmeden
-- sonra da GERÇEK ihale sahibini reddetmeye devam etti.
--
-- Bu kod tabanında zaten kanıtlanmış olan desene geçiliyor: is_admin()
-- fonksiyonunun üstündeki yorumun anlattığı gibi, bir RLS politikası
-- içinde RLS'e tabi başka tabloları (burada teklifler + ihaleler)
-- sorgulayan iç içe subquery'ler beklenmedik/güvenilmez şekilde
-- davranabiliyor. Çözüm: sahiplik kontrolünü RLS'i tamamen atlayan
-- SECURITY DEFINER bir yardımcı fonksiyona taşımak.
-- ============================================================

CREATE OR REPLACE FUNCTION public.teklif_ihale_sahibi_mi(p_teklif_id uuid, p_ihale_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teklifler t
    JOIN public.ihaleler i ON i.id = t.ihale_id
    WHERE t.id = p_teklif_id
      AND i.id = p_ihale_id
      AND i.olusturan_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.teklif_ihale_sahibi_mi(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Ihale sahibi kendi ihalesi icin teklif bildirebilir" ON public.teklif_bildirimleri;
CREATE POLICY "Ihale sahibi kendi ihalesi icin teklif bildirebilir"
  ON public.teklif_bildirimleri FOR INSERT WITH CHECK (
    auth.uid() = bildiren_id
    AND public.teklif_ihale_sahibi_mi(teklif_id, ihale_id)
  );
