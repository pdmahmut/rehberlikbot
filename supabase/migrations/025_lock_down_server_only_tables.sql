-- 025: Sunucu-only tablolari anon erisimine tamamen kapat.
--
-- Bu tablolara tarayicidan (anon key ile) HIC erisilmiyor; yalnizca
-- API route'lari uzerinden service_role ile okunup yaziliyor.
-- Bu yuzden RLS acilip TUM anon policy'leri kaldiriliyor.
-- service_role RLS'i bypass ettigi icin uygulama calismaya devam eder.
--
-- ON KOSUL: SUPABASE_SERVICE_ROLE_KEY ortam degiskeni tanimli olmali ve
-- guncel kod deploy edilmis olmali. Aksi halde giris/ogretmen yonetimi kirilir.

DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'teacher_users',
    'teacher_password_history',
    'class_students',
    'lesson_hours',
    'deletion_requests',
    'appointment_tasks',
    'discipline_records'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      RAISE NOTICE 'atlandi (tablo yok): %', t;
      CONTINUE;
    END IF;

    -- Mevcut tum policy'leri kaldir (hepsi anon'a acik "allow all" policy'leri)
    FOR p IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      RAISE NOTICE 'policy kaldirildi: %.%', t, p.policyname;
    END LOOP;

    -- RLS'i ac ve tablo sahibi icin de zorunlu kil
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

    -- anon ve authenticated rollerinden tablo yetkilerini geri al
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);

    RAISE NOTICE 'kilitlendi: %', t;
  END LOOP;
END $$;

-- Dogrulama: asagidaki sorgu her tablo icin rls_enabled = true ve policy_count = 0 vermeli.
--
--   SELECT c.relname          AS tablo,
--          c.relrowsecurity   AS rls_enabled,
--          c.relforcerowsecurity AS rls_forced,
--          (SELECT count(*) FROM pg_policies p
--             WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
--     FROM pg_class c
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relname IN ('teacher_users','teacher_password_history','class_students',
--                        'lesson_hours','deletion_requests','appointment_tasks','discipline_records')
--    ORDER BY 1;
