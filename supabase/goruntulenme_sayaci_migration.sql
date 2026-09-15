-- İhale detay sayfası her ziyaret edildiğinde goruntulenme_sayisi'ni
-- atomik olarak +1 artırır. Sütun zaten vardı ama hiçbir yerde
-- artırılmıyordu -- gerçek ihalelerde her zaman 0 gösteriliyordu
-- (bkz. ArsaSahibiPanel.tsx / ihaleler/[id]/page.tsx). SECURITY DEFINER
-- ile RLS'i atlar; ihaleler_kisitli_sutun_kontrol tetikleyicisi zaten
-- goruntulenme_sayisi'ni kısıtlı alanlar arasında saymıyor (bkz.
-- schema.sql'deki ilgili yorum), ayrıca herkese (anon dahil) açık.

CREATE OR REPLACE FUNCTION public.ihale_goruntulenme_arttir(p_ihale_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ihaleler SET goruntulenme_sayisi = goruntulenme_sayisi + 1 WHERE id = p_ihale_id;
$$;

GRANT EXECUTE ON FUNCTION public.ihale_goruntulenme_arttir(uuid) TO anon, authenticated;
