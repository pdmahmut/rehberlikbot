-- 028: class_students tablosundaki eksik kolonlari tamamla.
--
-- Migration 012 (status kolonu) uzaktaki veritabanina hicbir zaman
-- uygulanmamis. Kod bu kolonlari kullandigi icin ogrenci ekleme/guncelleme
-- islemleri sessizce basarisiz oluyordu.

BEGIN;

ALTER TABLE public.class_students
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'tumu',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_students_status_check') THEN
    ALTER TABLE public.class_students DROP CONSTRAINT class_students_status_check;
  END IF;
END $$;

ALTER TABLE public.class_students
  ADD CONSTRAINT class_students_status_check
  CHECK (status IN ('tumu', 'aktif_takip', 'duzenli_gorusme', 'tamamlandi'));

-- Ayni sinifta ayni ogrenci iki kez olmasin
CREATE UNIQUE INDEX IF NOT EXISTS class_students_class_name_uniq
  ON public.class_students (class_key, upper(student_name));

COMMIT;
