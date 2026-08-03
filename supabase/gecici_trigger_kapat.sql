-- ============================================================
-- İhaleTR — TANI AMAÇLI GEÇİCİ TEST
-- on_auth_user_email_confirmed tetikleyicisini geçici olarak
-- devre dışı bırakır. Amaç: Google OAuth girişindeki
-- "Database error saving new user" hatasının gerçekten bu
-- tetikleyiciden mi geldiğini netleştirmek.
--
-- KULLANIM:
-- 1) Aşağıdaki DISABLE komutunu SQL Editor'de çalıştırın.
-- 2) Google ile girişi tekrar deneyin.
--    - Hata KAYBOLURSA  → sorun kesin olarak bu tetikleyiciden
--      (handle_davet_odul_kaydi / davet_odulunu_baslat zincirinden)
--      kaynaklanıyor demektir; kalıcı düzeltmeye orada devam ederiz.
--    - Hata DEVAM EDERSE → sorun bu tetikleyiciden BAĞIMSIZ, başka
--      bir yerden (ör. on_auth_user_created / handle_new_user,
--      bir Auth Hook, ya da auth.identities/GoTrue'nun kendi iç
--      bir sorunu) geliyor demektir.
-- 3) Testten SONRA, dosyanın altındaki ENABLE komutunu MUTLAKA
--    çalıştırıp tetikleyiciyi tekrar açın — kapalı kalırsa davet
--    ödülü sistemi (arkadaşını davet et) e-posta onayında çalışmaz.
-- ============================================================

-- ── 1) DEVRE DIŞI BIRAK (test için) ──────────────────────────
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_email_confirmed;

-- Doğrulama: durum sütununun 'D' (disabled) olduğunu görmelisiniz.
select tgname, tgenabled
from pg_trigger
where tgrelid = 'auth.users'::regclass
  and tgname = 'on_auth_user_email_confirmed';


-- ── 2) TEKRAR AÇ (testten sonra MUTLAKA çalıştırın) ──────────
-- ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_email_confirmed;
--
-- select tgname, tgenabled
-- from pg_trigger
-- where tgrelid = 'auth.users'::regclass
--   and tgname = 'on_auth_user_email_confirmed';
