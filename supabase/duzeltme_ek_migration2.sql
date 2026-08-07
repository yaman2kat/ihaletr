-- KRITIK PROD BUG: teklif veren kisi ihalenin SAHIBI degilse (en yaygin/
-- normal senaryo), guncelle_mevcut_teklif() trigger'i bidder'in kendi
-- oturumuyla (RLS'e tabi, invoker) calistigi icin ihaleler UPDATE
-- politikasi (sadece sahibi/admin) bu guncellemeyi SESSIZCE engelliyordu
-- -- mevcut_teklif hicbir zaman guncellenmiyordu. Canli testte
-- dogrulandi. SECURITY DEFINER ile duzeltiliyor (RLS'i atlar, fonksiyon
-- yalnizca MIN(tutar) hesabi yapar, guvenlik riski yok).

CREATE OR REPLACE FUNCTION public.guncelle_mevcut_teklif()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ihale_id uuid := COALESCE(NEW.ihale_id, OLD.ihale_id);
BEGIN
  UPDATE public.ihaleler
  SET
    mevcut_teklif = (SELECT MIN(tutar) FROM public.teklifler WHERE ihale_id = v_ihale_id),
    updated_at    = now()
  WHERE id = v_ihale_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_teklif_degisti ON public.teklifler;
CREATE TRIGGER on_teklif_degisti
  AFTER INSERT OR UPDATE OR DELETE ON public.teklifler
  FOR EACH ROW EXECUTE FUNCTION public.guncelle_mevcut_teklif();

-- DOGRULAMA
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'guncelle_mevcut_teklif';
-- prosecdef = true olmali (SECURITY DEFINER)
