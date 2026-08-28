-- 029: Ogrenci verisi tutan tablolari anon erisimine kapat.
--
-- Bu tablolar panel sayfalarindan tarayici uzerinden DOGRUDAN okunuyordu.
-- Supabase anon anahtari tarayicida gorunur oldugu icin, uygulamayi hic
-- kullanmadan ogrenci isimleri ve ozel nitelikli kayitlar (akran zorbaligi,
-- multeci/gocmen, maddi durum, oksuz/yetim) okunabiliyordu.
--
-- Artik tum sorgular /api/db gecidinden gecer: oturum dogrulanir, tablo ve
-- islem izni kontrol edilir, ogretmen sorgularina sinif filtresi zorla
-- eklenir ve sorgu service_role ile calistirilir.
--
-- ON KOSUL: gecidi kullanan kod (dbClient + /api/db) deploy edilmis olmali.

DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'referrals',
    'observation_pool',
    'individual_requests',
    'parent_meeting_requests',
    'student_incidents',
    'appointments',
    'guidance_plans',
    'guidance_topics',
    'tasks',
    'follow_ups',
    'class_activities',
    'work_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      RAISE NOTICE 'atlandi (tablo yok): %', t;
      CONTINUE;
    END IF;

    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);

    RAISE NOTICE 'kilitlendi: %', t;
  END LOOP;
END $$;
