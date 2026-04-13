-- =============================================
-- Gözlem Havuzu Tablosunu Yeniden Oluşturma
-- =============================================

CREATE TABLE IF NOT EXISTS observation_pool (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  observed_at DATE DEFAULT CURRENT_DATE,
  student_name TEXT NOT NULL,
  student_number TEXT,
  class_key TEXT,
  class_display TEXT,

  observation_type TEXT NOT NULL CHECK (observation_type IN ('behavior', 'academic', 'social', 'emotional')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'converted')),

  completed_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL
);

ALTER TABLE observation_pool ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon observation_pool" ON observation_pool;
CREATE POLICY "Allow all for anon observation_pool" ON observation_pool
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_observation_pool_student ON observation_pool(student_name);
CREATE INDEX IF NOT EXISTS idx_observation_pool_class ON observation_pool(class_key);
CREATE INDEX IF NOT EXISTS idx_observation_pool_status ON observation_pool(status);
CREATE INDEX IF NOT EXISTS idx_observation_pool_created_at ON observation_pool(created_at DESC);

DROP TRIGGER IF EXISTS update_observation_pool_updated_at ON observation_pool;
CREATE TRIGGER update_observation_pool_updated_at
  BEFORE UPDATE ON observation_pool
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

SELECT 'Gözlem havuzu tablosu yeniden oluşturuldu!' as message;