ALTER TABLE student_incidents
  ADD COLUMN IF NOT EXISTS case_group_id UUID;

ALTER TABLE student_incidents
  ADD COLUMN IF NOT EXISTS record_role TEXT DEFAULT 'main';

ALTER TABLE student_incidents
  ADD COLUMN IF NOT EXISTS linked_from_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_incidents_record_role_check'
  ) THEN
    ALTER TABLE student_incidents
      ADD CONSTRAINT student_incidents_record_role_check
      CHECK (record_role IN ('main', 'linked_reporter'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_incidents_linked_from_id_fkey'
  ) THEN
    ALTER TABLE student_incidents
      ADD CONSTRAINT student_incidents_linked_from_id_fkey
      FOREIGN KEY (linked_from_id) REFERENCES student_incidents(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_incidents_group ON student_incidents(case_group_id);
CREATE INDEX IF NOT EXISTS idx_student_incidents_role ON student_incidents(record_role);
