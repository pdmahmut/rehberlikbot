-- =============================================
-- Bireysel Başvurular Tablosunu Yeniden Oluşturma
-- =============================================

CREATE TABLE IF NOT EXISTS individual_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  student_name TEXT NOT NULL,
  class_key TEXT,
  class_display TEXT,
  request_date DATE NOT NULL,
  note TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled'))
);

ALTER TABLE individual_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon individual_requests" ON individual_requests;
CREATE POLICY "Allow all for anon individual_requests"
  ON individual_requests
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_individual_requests_student ON individual_requests(student_name);
CREATE INDEX IF NOT EXISTS idx_individual_requests_status ON individual_requests(status);
CREATE INDEX IF NOT EXISTS idx_individual_requests_created_at ON individual_requests(created_at);

SELECT 'Bireysel başvurular tablosu yeniden oluşturuldu!' as message;