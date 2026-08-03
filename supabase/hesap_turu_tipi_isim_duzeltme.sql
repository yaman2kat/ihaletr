-- ============================================================
-- IhaleTR - Fix for "type hesap_turu_tipi does not exist".
-- Paste this into Supabase Dashboard > SQL Editor and run it.
-- Plain ASCII only (no Turkish characters) to avoid encoding issues.
-- ============================================================
--
-- Root cause: handle_new_user(), davet_odulunu_baslat() and
-- oauth_kayit_tamamla() all declare variables/params of type
-- "hesap_turu_tipi". At some point after that type was created, the
-- enum backing the kullanicilar.hesap_turu column was renamed to
-- something else (most likely via the Supabase Table Editor UI) -
-- the column is still there, but the enum type no longer has the
-- name "hesap_turu_tipi". So any fresh Postgres connection that
-- compiles one of these functions for the first time (e.g. GoTrue's
-- own connection during signup/login) fails with
-- "type hesap_turu_tipi does not exist".
--
-- Fix: without touching any function body, find whatever the column
-- is really backed by right now and rename that type BACK to
-- "hesap_turu_tipi". This makes handle_new_user(),
-- davet_odulunu_baslat(), oauth_kayit_tamamla() and the column all
-- consistent again in one shot.

-- ── 1) DIAGNOSTIC (read-only): shows the column's real current type ──
select
  a.attname as column_name,
  t.typname as actual_type_name,
  t.typtype as type_kind   -- 'e' = enum (expected); anything else means trouble
from pg_attribute a
join pg_type t on t.oid = a.atttypid
where a.attrelid = 'public.kullanicilar'::regclass
  and a.attname = 'hesap_turu'
  and a.attnum > 0
  and not a.attisdropped;

-- Optional: list the enum labels too
select t.typname, e.enumlabel, e.enumsortorder
from pg_type t
join pg_enum e on e.enumtypid = t.oid
where t.typname ilike '%hesap%tur%'
order by t.typname, e.enumsortorder;


-- ── 2) FIX: rename the type back to "hesap_turu_tipi" ────────────────
DO $$
DECLARE
  v_actual_type text;
  v_type_kind   char;
BEGIN
  SELECT t.typname, t.typtype
  INTO   v_actual_type, v_type_kind
  FROM pg_attribute a
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE a.attrelid = 'public.kullanicilar'::regclass
    AND a.attname = 'hesap_turu'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_actual_type IS NULL THEN
    RAISE EXCEPTION 'Column public.kullanicilar.hesap_turu was not found. Check that hesap_turu_migration.sql has been applied.';
  END IF;

  IF v_type_kind <> 'e' THEN
    RAISE EXCEPTION 'kullanicilar.hesap_turu is not an enum column (found type: %, kind: %). Stop and report this back before continuing.', v_actual_type, v_type_kind;
  END IF;

  IF v_actual_type = 'hesap_turu_tipi' THEN
    RAISE NOTICE 'Type is already named "hesap_turu_tipi" - nothing to change. The error must be coming from somewhere else.';
  ELSE
    EXECUTE format('ALTER TYPE %I RENAME TO hesap_turu_tipi', v_actual_type);
    RAISE NOTICE 'Renamed type "%" to "hesap_turu_tipi".', v_actual_type;
  END IF;
END $$;


-- ── 3) VERIFY: confirm the rename took effect ─────────────────────────
select
  a.attname as column_name,
  t.typname as type_name
from pg_attribute a
join pg_type t on t.oid = a.atttypid
where a.attrelid = 'public.kullanicilar'::regclass
  and a.attname = 'hesap_turu'
  and a.attnum > 0
  and not a.attisdropped;
-- type_name should now be 'hesap_turu_tipi'.
