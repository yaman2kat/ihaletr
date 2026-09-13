-- ============================================================
-- İhaleTR — Tapu mükerrerlik kontrolü + sahte/boş teklif tespit ve
-- ceza sistemi
-- Supabase Dashboard > SQL Editor > New Query'e yapıştırıp çalıştırın.
-- Idempotent: birden fazla kez çalıştırılabilir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) TAPU MÜKERRERLİK KONTROLÜ
--    belgeler.dosya_hash: yalnızca tur='tapu' satırlarında doldurulur
--    (istemci tarafında crypto.subtle.digest("SHA-256", ...) ile
--    hesaplanır, bkz. ihale-olustur/page.tsx). Mükerrerlik sorgusu
--    ekstra bir RPC gerektirmez: belgeler SELECT RLS'i zaten tapu
--    türü belgeleri yalnızca admin'e açıyor, ihaleler SELECT'i
--    herkese açık — admin doğrudan client sorgularıyla karşılaştırma
--    yapabilir.
-- ------------------------------------------------------------

ALTER TABLE public.belgeler
  ADD COLUMN IF NOT EXISTS dosya_hash text;

CREATE INDEX IF NOT EXISTS idx_belgeler_tapu_hash
  ON public.belgeler(dosya_hash) WHERE tur = 'tapu';

-- ------------------------------------------------------------
-- 2) ŞÜPHELİ TEKLİF TESPİTİ — dosya boyutları
--    Boyutlar upload aninda (TeklifKutusu.tsx) yazilir; "supheli"
--    hesabi ihale sahibinin sonuc raporunu actiginda istemci
--    tarafinda anlik yapilir (ekstra bir cron/job gerekmez).
-- ------------------------------------------------------------

ALTER TABLE public.teklifler
  ADD COLUMN IF NOT EXISTS teklif_dosyasi_boyut   bigint,
  ADD COLUMN IF NOT EXISTS alternatif_proje_boyut bigint;

-- ------------------------------------------------------------
-- 3) TEKLİF BİLDİRİMLERİ — ihale sahibi şüpheli/sahte teklifi bildirir,
--    admin inceler ve gerekirse ikaz gönderir.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.teklif_bildirimleri (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teklif_id           uuid        NOT NULL REFERENCES public.teklifler(id) ON DELETE CASCADE,
  ihale_id            uuid        NOT NULL REFERENCES public.ihaleler(id) ON DELETE CASCADE,
  bildiren_id         uuid        NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
  sebep               text        NOT NULL CHECK (sebep IN (
                        'dosya_bos', 'proje_ilgisiz', 'sartlar_eksik', 'sahte_kopya', 'diger'
                      )),
  aciklama            text,
  durum               text        NOT NULL DEFAULT 'beklemede'
                        CHECK (durum IN ('beklemede', 'incelendi', 'ikaz_gonderildi')),
  admin_notu          text,
  ikaz_gonderildi     boolean     NOT NULL DEFAULT false,
  olusturulma_tarihi  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teklif_bildirimleri_ihale   ON public.teklif_bildirimleri(ihale_id);
CREATE INDEX IF NOT EXISTS idx_teklif_bildirimleri_durum   ON public.teklif_bildirimleri(durum);
CREATE INDEX IF NOT EXISTS idx_teklif_bildirimleri_bildiren ON public.teklif_bildirimleri(bildiren_id);

ALTER TABLE public.teklif_bildirimleri ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bildiren ve admin gorebilir" ON public.teklif_bildirimleri;
CREATE POLICY "Bildiren ve admin gorebilir"
  ON public.teklif_bildirimleri FOR SELECT USING (
    auth.uid() = bildiren_id OR public.is_admin()
  );

-- Yalnizca GERCEK ihale sahibi, KENDI ihalesindeki bir teklifi
-- bildirebilir -- bildiren_id sahtekarlik yapip baskasi adina ya da
-- kendisine ait olmayan bir ihale icin bildirim acamaz.
DROP POLICY IF EXISTS "Ihale sahibi kendi ihalesi icin teklif bildirebilir" ON public.teklif_bildirimleri;
CREATE POLICY "Ihale sahibi kendi ihalesi icin teklif bildirebilir"
  ON public.teklif_bildirimleri FOR INSERT WITH CHECK (
    auth.uid() = bildiren_id
    AND EXISTS (SELECT 1 FROM public.ihaleler WHERE id = ihale_id AND olusturan_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.teklifler WHERE id = teklif_id AND ihale_id = teklif_bildirimleri.ihale_id)
  );

-- admin_notu/durum/ikaz_gonderildi yalnizca admin tarafindan guncellenir.
DROP POLICY IF EXISTS "Admin bildirimi guncelleyebilir" ON public.teklif_bildirimleri;
CREATE POLICY "Admin bildirimi guncelleyebilir"
  ON public.teklif_bildirimleri FOR UPDATE USING (public.is_admin());

-- ------------------------------------------------------------
-- 4) bildirimler: muteahhide giden ikaz bildirimi icin yeni tur
-- ------------------------------------------------------------

ALTER TABLE public.bildirimler DROP CONSTRAINT IF EXISTS bildirimler_tur_check;
ALTER TABLE public.bildirimler ADD CONSTRAINT bildirimler_tur_check CHECK (tur IN (
  'yeni_teklif', 'ihale_onaylandi', 'ihale_reddedildi', 'ihale_otomatik_sonlandi',
  'davet_odulu', 'odeme_sorunu', 'bolge_eslesmesi', 'davet_limit_asildi', 'teklif_ikazi'
));

-- ------------------------------------------------------------
-- 5) Admin, "Sorgulanan Teklifler" sayfasinda bildirilen teklifin
--    dosyasini acabilsin diye "ihale-teklif-dosyalari" private
--    bucket'inin SELECT politikasina admin istisnasi eklenir (su ana
--    kadar admin bu bucket'i hic okuyamiyordu -- mevcut bir eksiklik).
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Teklif dosyasi sadece ihale bitince yetkiliye acik" ON storage.objects;
CREATE POLICY "Teklif dosyasi sadece ihale bitince yetkiliye acik"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'ihale-teklif-dosyalari'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.ihaleler i
        WHERE i.id::text = (storage.foldername(name))[1]
          AND (i.durum = 'tamamlandi' OR (i.durum = 'aktif' AND i.bitis_tarihi < CURRENT_DATE))
          AND (
            i.olusturan_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.teklifler t WHERE t.ihale_id = i.id AND t.kullanici_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.kullanicilar k WHERE k.id = auth.uid() AND k.plan_turu = 'kurumsal')
          )
      )
    )
  );

-- DOGRULAMA
SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'belgeler' AND column_name = 'dosya_hash';
SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'teklifler'
  AND column_name IN ('teklif_dosyasi_boyut', 'alternatif_proje_boyut');
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teklif_bildirimleri';
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teklif_bildirimleri';
SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = 'Teklif dosyasi sadece ihale bitince yetkiliye acik';
