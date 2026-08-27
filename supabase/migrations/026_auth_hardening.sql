-- 026: Kimlik dogrulama semasinin yeniden yapilandirilmasi.
--
-- Degisiklikler:
--   1. teacher_users: duz metin sifre -> kor indeks (lookup) + sifreli saklama (cipher)
--   2. teacher_password_history: duz metin -> kor indeks
--   3. app_settings: yonetici sifresi (hash'li) icin. Onceden var/admin-password.json
--      icinde duz metin tutuluyordu ve Vercel'de kalici degildi.
--   4. login_attempts: kaba kuvvet sinirlamasi icin
--
-- UYARI: Mevcut ogretmen hesaplari ve sifreleri SILINIR. Sifreler geri
-- donusturulemez bicimde yeniden uretilecegi icin tasima yapilmaz.
-- Yil basi hesap olusturma akisindan yeniden uretin.
--
-- ON KOSUL: PASSWORD_SECRET ve SESSION_SECRET ortam degiskenleri tanimli olmali.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. teacher_users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  teacher_name TEXT NOT NULL,
  class_key TEXT,
  class_display TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eski duz metin sifre kolonu ve verisi kaldiriliyor
TRUNCATE TABLE public.teacher_users CASCADE;
ALTER TABLE public.teacher_users DROP COLUMN IF EXISTS password_hash;

ALTER TABLE public.teacher_users
  ADD COLUMN IF NOT EXISTS password_lookup TEXT,
  ADD COLUMN IF NOT EXISTS password_cipher TEXT;

-- Sadece-sifre girisi: ayni sifre iki hesapta olamaz
CREATE UNIQUE INDEX IF NOT EXISTS teacher_users_password_lookup_key
  ON public.teacher_users (password_lookup)
  WHERE password_lookup IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. teacher_password_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_password_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_user_id UUID REFERENCES public.teacher_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

TRUNCATE TABLE public.teacher_password_history;
ALTER TABLE public.teacher_password_history DROP COLUMN IF EXISTS normalized_password;
ALTER TABLE public.teacher_password_history
  ADD COLUMN IF NOT EXISTS password_lookup TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS teacher_password_history_lookup_idx
  ON public.teacher_password_history (password_lookup);

-- ---------------------------------------------------------------------------
-- 3. app_settings  (yonetici sifresi hash'i burada)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. login_attempts  (kaba kuvvet sinirlamasi)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip TEXT NOT NULL,
  role TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_attempts_ip_time_idx
  ON public.login_attempts (ip, attempted_at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_time_idx
  ON public.login_attempts (attempted_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Hepsini anon erisimine kapat (yalnizca service_role erisir)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'teacher_users',
    'teacher_password_history',
    'app_settings',
    'login_attempts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

COMMIT;

-- Dogrulama:
--   SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
--          (SELECT count(*) FROM pg_policies p
--            WHERE p.schemaname='public' AND p.tablename=c.relname) AS policies
--     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--    WHERE n.nspname='public'
--      AND c.relname IN ('teacher_users','teacher_password_history','app_settings','login_attempts');
--
-- Beklenen: relrowsecurity=t, relforcerowsecurity=t, policies=0
