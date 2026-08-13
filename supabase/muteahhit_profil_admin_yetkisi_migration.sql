-- Muteahhit profili duzenleme yetkisi: sadece profil sahibi ve admin
-- profili guncelleyebilsin. Mevcut politika sadece sahibine izin
-- veriyordu (admin de dahil hic kimse baskasinin profilini
-- guncelleyemiyordu); artik admin de dahil ediliyor.
-- Idempotent, tek "Run" ile guvenle calisir.

DROP POLICY IF EXISTS "Profil sahibi profilini guncelleyebilir" ON public.muteahhit_profiller;
CREATE POLICY "Profil sahibi ve admin profili guncelleyebilir"
  ON public.muteahhit_profiller FOR UPDATE USING (
    auth.uid() = kullanici_id OR public.is_admin()
  );

-- DOGRULAMA
SELECT policyname, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'muteahhit_profiller' AND cmd = 'UPDATE';
