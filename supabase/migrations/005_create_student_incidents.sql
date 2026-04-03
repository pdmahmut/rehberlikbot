-- Öğrenci bildirimi / akran şikayeti kayıtları
CREATE TABLE IF NOT EXISTS student_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  case_group_id UUID,
  record_role TEXT DEFAULT 'main' CHECK (record_role IN ('main', 'linked_reporter')),
  linked_from_id UUID REFERENCES student_incidents(id) ON DELETE SET NULL,

  incident_date DATE DEFAULT CURRENT_DATE,

  reporter_type TEXT DEFAULT 'student' CHECK (reporter_type IN ('student', 'teacher', 'parent', 'anonymous')),
  reporter_student_name TEXT,
  reporter_class_key TEXT,
  reporter_class_display TEXT,

  target_student_name TEXT NOT NULL,
  target_class_key TEXT,
  target_class_display TEXT,

  incident_type TEXT DEFAULT 'conflict' CHECK (incident_type IN ('bullying', 'conflict', 'threat', 'verbal', 'physical', 'damage', 'theft', 'other')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'dismissed')),

  description TEXT NOT NULL,
  location TEXT,
  action_taken TEXT,
  follow_up_date DATE,
  notes TEXT,
  is_confidential BOOLEAN DEFAULT FALSE
);

ALTER TABLE student_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon student_incidents" ON student_incidents;
CREATE POLICY "Allow all for anon student_incidents" ON student_incidents
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_student_incidents_target ON student_incidents(target_student_name);
CREATE INDEX IF NOT EXISTS idx_student_incidents_reporter ON student_incidents(reporter_student_name);
CREATE INDEX IF NOT EXISTS idx_student_incidents_group ON student_incidents(case_group_id);
CREATE INDEX IF NOT EXISTS idx_student_incidents_role ON student_incidents(record_role);
CREATE INDEX IF NOT EXISTS idx_student_incidents_status ON student_incidents(status);
CREATE INDEX IF NOT EXISTS idx_student_incidents_date ON student_incidents(incident_date);
