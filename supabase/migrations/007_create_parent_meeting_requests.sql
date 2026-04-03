CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS parent_meeting_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  student_name TEXT NOT NULL,
  class_key TEXT,
  class_display TEXT,
  parent_name TEXT,
  parent_relation TEXT,
  parent_phone TEXT,

  request_type TEXT DEFAULT 'gorusme' CHECK (request_type IN ('gorusme', 'bilgilendirme', 'destek', 'acil', 'diger')),
  subject TEXT NOT NULL,
  detail TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'scheduled', 'closed')),
  preferred_contact TEXT
);

ALTER TABLE parent_meeting_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon parent_meeting_requests" ON parent_meeting_requests;
CREATE POLICY "Allow all for anon parent_meeting_requests"
  ON parent_meeting_requests
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_parent_meeting_requests_student ON parent_meeting_requests(student_name);
CREATE INDEX IF NOT EXISTS idx_parent_meeting_requests_status ON parent_meeting_requests(status);
CREATE INDEX IF NOT EXISTS idx_parent_meeting_requests_created_at ON parent_meeting_requests(created_at);
