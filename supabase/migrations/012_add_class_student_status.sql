-- class_students tablosuna durum alanı eklenir

ALTER TABLE class_students
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'tumu';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'class_students_status_check'
  ) THEN
    ALTER TABLE class_students DROP CONSTRAINT class_students_status_check;
  END IF;
END $$;

ALTER TABLE class_students
  ADD CONSTRAINT class_students_status_check
  CHECK (status IN ('tumu', 'aktif_takip', 'duzenli_gorusme', 'tamamlandi'));

UPDATE class_students
SET status = COALESCE(NULLIF(status, ''), 'tumu');
