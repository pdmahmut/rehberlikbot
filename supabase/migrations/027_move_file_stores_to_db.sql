-- 027: Disk dosyalarinda tutulan verileri veritabanina tasi.
--
-- Sorun: var/*.json dosyalari Vercel'in gecici dosya sisteminde duruyordu.
-- Canlida yapilan degisiklikler (ogretmen ekleme, sinif talebi, bildirim
-- okundu isareti) her deploy'da veya sunucu yeniden basladiginda kayboluyordu.
--
-- Bu migration yalnizca tablolari OLUSTURUR. Mevcut JSON verisini tasimak icin
-- migration sonrasi `node scripts/import-file-stores.mjs` calistirilmalidir.

BEGIN;

-- ---------------------------------------------------------------------------
-- teachers  (kaynak: var/teachers.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teachers (
  teacher_id TEXT PRIMARY KEY,
  teacher_name TEXT NOT NULL,
  teacher_name_normalized TEXT NOT NULL,
  sinif_sube_key TEXT,
  sinif_sube_display TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ayni ogretmen iki kez eklenemesin
CREATE UNIQUE INDEX IF NOT EXISTS teachers_name_normalized_key
  ON public.teachers (teacher_name_normalized);

-- Sinifa gore arama icin. UNIQUE degil: sinif bir ogretmenden digerine
-- devredilirken toplu guncelleme sirasinda gecici cakisma olusabiliyor.
-- Tek rehber ogretmen kurali uygulama katmaninda (assignTeacherToClass) saglaniyor.
CREATE INDEX IF NOT EXISTS teachers_sinif_sube_key_idx
  ON public.teachers (sinif_sube_key)
  WHERE sinif_sube_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- class_student_requests  (kaynak: var/class-student-requests.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_student_requests (
  id TEXT PRIMARY KEY,
  teacher_name TEXT NOT NULL,
  class_key TEXT NOT NULL,
  class_display TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_value TEXT,
  request_type TEXT NOT NULL CHECK (request_type IN ('delete', 'class_change')),
  new_class_key TEXT,
  new_class_display TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS class_student_requests_status_idx
  ON public.class_student_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS class_student_requests_class_idx
  ON public.class_student_requests (class_key);

-- ---------------------------------------------------------------------------
-- admin_notification_states  (kaynak: var/admin-notification-states.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_notification_states (
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  viewer_role TEXT NOT NULL DEFAULT 'admin',
  read_at TIMESTAMPTZ,
  popup_seen_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_type, source_id, viewer_role)
);

-- ---------------------------------------------------------------------------
-- Hepsini anon erisimine kapat (yalnizca API rotalari uzerinden erisilecek)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'teachers',
    'class_student_requests',
    'admin_notification_states'
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
