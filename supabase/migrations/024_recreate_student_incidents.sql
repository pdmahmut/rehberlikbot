-- =============================================
-- Öğrenci Bildirimleri Tablosunu Yeniden Oluşturma
-- =============================================

CREATE TABLE IF NOT EXISTS student_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Olay bilgileri
  incident_date DATE DEFAULT CURRENT_DATE,
  
  -- Bildirimi yapan öğrenci
  reporter_student_name TEXT,
  reporter_class_key TEXT,
  reporter_class_display TEXT,
  
  -- Hedef öğrenci (bildirim yapılan)
  target_student_name TEXT NOT NULL,
  target_class_key TEXT,
  target_class_display TEXT,
  
  -- Olay detayları
  description TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'dismissed')),
  
  -- Gruplama için
  case_group_id UUID,
  record_role TEXT DEFAULT 'main' CHECK (record_role IN ('main', 'linked_reporter')),
  linked_from_id UUID REFERENCES student_incidents(id) ON DELETE SET NULL
);

-- RLS politikaları
ALTER TABLE student_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon student_incidents" ON student_incidents;
CREATE POLICY "Allow all for anon student_incidents" ON student_incidents
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_student_incidents_target ON student_incidents(target_student_name);
CREATE INDEX IF NOT EXISTS idx_student_incidents_reporter ON student_incidents(reporter_student_name);
CREATE INDEX IF NOT EXISTS idx_student_incidents_status ON student_incidents(status);
CREATE INDEX IF NOT EXISTS idx_student_incidents_date ON student_incidents(incident_date);

SELECT 'Öğrenci bildirimleri tablosu başarıyla yeniden oluşturuldu!' as message;
