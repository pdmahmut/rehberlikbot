-- 031: Sinif listesini veritabanina tasi.
--
-- Onceki durum: sinif listesi (5A, 5B, ... ) data.json dosyasinda sabitti.
-- Yeni bir sube acmak (ornegin 5D) dosyayi elle duzenleyip yeniden deploy
-- etmeyi gerektiriyordu. Artik sinif listesi PDF yuklemesinden olusuyor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.classes (
  class_key TEXT PRIMARY KEY,
  class_display TEXT NOT NULL,
  grade INTEGER,
  section TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS classes_sort_idx ON public.classes (sort_order, class_key);

-- Ogrenci yukleme islemlerinin kaydi (ne zaman, kim, kac kayit)
CREATE TABLE IF NOT EXISTS public.student_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT,
  mode TEXT NOT NULL,
  class_count INTEGER NOT NULL DEFAULT 0,
  student_count INTEGER NOT NULL DEFAULT 0,
  removed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Anon erisimine kapali: yalnizca API rotalari uzerinden erisilir
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['classes', 'student_imports'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

COMMIT;
