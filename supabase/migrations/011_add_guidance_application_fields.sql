-- Merkezi başvuru/görüşme akışı için alanlar

ALTER TABLE observation_pool
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'observation',
  ADD COLUMN IF NOT EXISTS source_record_id TEXT,
  ADD COLUMN IF NOT EXISTS source_record_table TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'observation_pool_status_check'
  ) THEN
    ALTER TABLE observation_pool DROP CONSTRAINT observation_pool_status_check;
  END IF;
END $$;

ALTER TABLE observation_pool
  ADD CONSTRAINT observation_pool_status_check
  CHECK (status IN ('pending', 'scheduled', 'active_follow', 'regular_meeting', 'completed', 'converted'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'observation_pool_source_type_check'
  ) THEN
    ALTER TABLE observation_pool DROP CONSTRAINT observation_pool_source_type_check;
  END IF;
END $$;

ALTER TABLE observation_pool
  ADD CONSTRAINT observation_pool_source_type_check
  CHECK (source_type IN ('observation', 'student_report', 'teacher_referral', 'parent_request', 'self_application'));

CREATE INDEX IF NOT EXISTS idx_observation_pool_source_type ON observation_pool(source_type);
CREATE INDEX IF NOT EXISTS idx_observation_pool_source_record ON observation_pool(source_type, source_record_id);

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS source_application_id TEXT,
  ADD COLUMN IF NOT EXISTS source_application_type TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_source_application ON appointments(source_application_type, source_application_id);

UPDATE observation_pool
SET source_type = COALESCE(source_type, 'observation')
WHERE source_type IS NULL;

