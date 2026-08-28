-- 030: class_requests ve class_request_categories tablolarini anon erisimine kapat.
--
-- Onceki durum (migration 020-022): bu tablolarda RLS vardi, ancak politikalar
-- HTTP basliklarina bakiyordu:
--
--     public.app_request_header('x-app-role') = 'admin'
--
-- Basliklari sunucu ekliyordu, ama anon anahtar tarayicida gorunur oldugu icin
-- herhangi biri kendi istegine "x-app-role: admin" basligini koyup yonetici
-- gibi davranabiliyordu. Yani RLS vardi fakat gercek bir sinir degildi.
--
-- Yeni durum: rotalar service_role kullaniyor, ogretmen kisitlari (kendi
-- talebi / kendi sinifi) API kodunda uygulaniyor. Tablolar anon erisimine
-- tamamen kapatiliyor ve baslik tabanli politikalar kaldiriliyor.
--
-- ON KOSUL: guncel kod deploy edilmis olmali.

BEGIN;

DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY['class_requests', 'class_request_categories'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      RAISE NOTICE 'atlandi (tablo yok): %', t;
      CONTINUE;
    END IF;

    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      RAISE NOTICE 'policy kaldirildi: %.%', t, p.policyname;
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);

    RAISE NOTICE 'kilitlendi: %', t;
  END LOOP;
END $$;

-- Baslik okuyan yardimci fonksiyon artik kullanilmiyor.
DROP FUNCTION IF EXISTS public.app_request_header(TEXT);

COMMIT;
