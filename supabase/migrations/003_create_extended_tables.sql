-- =============================================
-- RPD App - Genişletilmiş Tablolar
-- =============================================
-- Bu SQL'i Supabase Dashboard > SQL Editor'de çalıştırın

-- =============================================
-- 1. GÖREVLER (Yapılacaklar) TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'genel' CHECK (category IN ('genel', 'randevu', 'veli', 'ogretmen', 'rapor', 'diger')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date DATE,
  due_time TIME,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- İlişkili kayıtlar
  related_student_name TEXT,
  related_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL
);

-- =============================================
-- 2. VAKA NOTLARI TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS case_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  student_name TEXT NOT NULL,
  class_key TEXT,
  class_display TEXT,
  note_date DATE DEFAULT CURRENT_DATE,
  note_type TEXT DEFAULT 'gozlem' CHECK (note_type IN ('gozlem', 'gorusme', 'degerlendirme', 'plan', 'diger')),
  content TEXT NOT NULL,
  is_confidential BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}'
);

-- =============================================
-- 3. RİSK TAKİP TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS risk_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  student_name TEXT NOT NULL,
  class_key TEXT,
  class_display TEXT,
  risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_type TEXT[] DEFAULT '{}', -- intihar_riski, ihmal_istismar, siddet, madde, diger
  description TEXT,
  intervention_plan TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'monitoring', 'resolved', 'referred')),
  last_contact_date DATE,
  next_follow_up_date DATE,
  notes TEXT,
  
  -- İlişkili yönlendirme
  related_referral_id UUID,
  related_ram_id UUID
);

-- =============================================
-- 4. TAKİP HATIRLATICILARI TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  student_name TEXT NOT NULL,
  class_key TEXT,
  class_display TEXT,
  follow_up_date DATE NOT NULL,
  follow_up_type TEXT DEFAULT 'gorusme' CHECK (follow_up_type IN ('gorusme', 'telefon', 'veli', 'ogretmen', 'ram', 'diger')),
  reason TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'postponed')),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- İlişkili kayıtlar
  source_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  created_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL
);

-- =============================================
-- 5. RAM YÖNLENDİRME TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS ram_referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  student_name TEXT NOT NULL,
  class_key TEXT,
  class_display TEXT,
  birth_date DATE,
  parent_name TEXT,
  parent_phone TEXT,
  
  -- Başvuru bilgileri
  referral_date DATE DEFAULT CURRENT_DATE,
  referral_reason TEXT NOT NULL, -- Özel eğitim, Üstün zeka, Dikkat eksikliği, vb.
  detailed_description TEXT,
  supporting_documents TEXT[], -- Belge listesi
  
  -- Süreç takibi
  status TEXT DEFAULT 'hazirlaniyor' CHECK (status IN ('hazirlaniyor', 'gonderildi', 'degerlendirmede', 'sonuclandi', 'iptal')),
  sent_date DATE,
  evaluation_date DATE,
  result_date DATE,
  result_summary TEXT,
  recommendation TEXT,
  
  -- Sonuç
  diagnosis TEXT,
  iep_required BOOLEAN DEFAULT FALSE, -- BEP gerekli mi?
  next_evaluation_date DATE,
  notes TEXT
);

-- =============================================
-- 6. SINIF ETKİNLİKLERİ TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS class_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  class_key TEXT NOT NULL,
  class_display TEXT,
  activity_date DATE NOT NULL,
  activity_time TIME,
  duration INTEGER DEFAULT 40, -- dakika
  
  activity_type TEXT DEFAULT 'rehberlik' CHECK (activity_type IN ('rehberlik', 'sosyal_duygusal', 'kariyer', 'zorbalik_onleme', 'diger')),
  topic TEXT NOT NULL,
  description TEXT,
  materials_used TEXT,
  
  -- Katılım ve değerlendirme
  participant_count INTEGER,
  observations TEXT,
  effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
  notes TEXT,
  follow_up_needed BOOLEAN DEFAULT FALSE
);

-- =============================================
-- 7. SINIF GÖZLEM NOTLARI TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS class_observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  class_key TEXT NOT NULL,
  class_display TEXT,
  observation_date DATE NOT NULL,
  observer_name TEXT, -- Kim gözlem yaptı (öğretmen adı)
  observation_type TEXT DEFAULT 'genel' CHECK (observation_type IN ('genel', 'davranis', 'sosyal', 'akademik', 'ozel_ogrenci')),
  
  content TEXT NOT NULL,
  students_mentioned TEXT[], -- Bahsedilen öğrenci adları
  action_taken TEXT,
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_notes TEXT
);

-- =============================================
-- 8. SOSYOMETRİ TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS sociometry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  class_key TEXT NOT NULL,
  class_display TEXT,
  survey_date DATE NOT NULL,
  
  -- Sonuçlar (JSON formatında)
  popular_students JSONB DEFAULT '[]', -- [{name, score}]
  isolated_students JSONB DEFAULT '[]',
  rejected_students JSONB DEFAULT '[]',
  mutual_friendships JSONB DEFAULT '[]', -- [{student1, student2}]
  cliques JSONB DEFAULT '[]', -- [[student1, student2, student3]]
  
  analysis_notes TEXT,
  intervention_plan TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('planned', 'in_progress', 'completed', 'analyzed'))
);

-- =============================================
-- 9. HEDEFLER TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  academic_year TEXT NOT NULL, -- 2025-2026
  semester TEXT DEFAULT '1' CHECK (semester IN ('1', '2', 'yillik')),
  
  category TEXT DEFAULT 'genel' CHECK (category IN ('bireysel_gorusme', 'grup_calismasi', 'sinif_rehberlik', 'veli_gorusme', 'ogretmen_isbirligi', 'ram_yonlendirme', 'diger')),
  title TEXT NOT NULL,
  description TEXT,
  target_count INTEGER, -- Hedef sayı
  current_count INTEGER DEFAULT 0, -- Mevcut sayı
  target_percentage DECIMAL(5,2), -- Hedef yüzde
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  completion_date DATE,
  notes TEXT
);

-- =============================================
-- 10. VELİ İLETİŞİM TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS parent_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  student_name TEXT NOT NULL,
  class_key TEXT,
  class_display TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  
  contact_date DATE NOT NULL,
  contact_time TIME,
  contact_type TEXT DEFAULT 'telefon' CHECK (contact_type IN ('telefon', 'yuz_yuze', 'online', 'mesaj', 'diger')),
  direction TEXT DEFAULT 'outgoing' CHECK (direction IN ('incoming', 'outgoing')),
  
  topic TEXT,
  summary TEXT NOT NULL,
  action_items TEXT,
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  
  -- İlişkili kayıtlar
  related_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL
);

-- =============================================
-- 11. AYARLAR TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  category TEXT DEFAULT 'genel' CHECK (category IN ('genel', 'okul', 'bildirim', 'sablon', 'gorunum'))
);

-- Varsayılan ayarları ekle
INSERT INTO settings (setting_key, setting_value, category) VALUES
  ('school_name', '"DUMLUPINAR ORTAOKULU"', 'okul'),
  ('school_address', '""', 'okul'),
  ('school_phone', '""', 'okul'),
  ('counselor_name', '"Mahmut Karadeniz"', 'okul'),
  ('counselor_title', '"Rehber Öğretmen ve Psikolojik Danışman"', 'okul'),
  ('academic_year', '"2025-2026"', 'genel'),
  ('semester', '"1"', 'genel'),
  ('telegram_notifications', 'true', 'bildirim'),
  ('email_notifications', 'false', 'bildirim'),
  ('daily_summary', 'true', 'bildirim'),
  ('theme', '"light"', 'gorunum'),
  ('sidebar_collapsed', 'false', 'gorunum')
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- RLS (Row Level Security) Politikaları
-- =============================================

-- Tasks tablosu için RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon tasks" ON tasks;
CREATE POLICY "Allow all for anon tasks" ON tasks
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Case notes tablosu için RLS
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon case_notes" ON case_notes;
CREATE POLICY "Allow all for anon case_notes" ON case_notes
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Risk students tablosu için RLS
ALTER TABLE risk_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon risk_students" ON risk_students;
CREATE POLICY "Allow all for anon risk_students" ON risk_students
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Follow ups tablosu için RLS
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon follow_ups" ON follow_ups;
CREATE POLICY "Allow all for anon follow_ups" ON follow_ups
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- RAM referrals tablosu için RLS
ALTER TABLE ram_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon ram_referrals" ON ram_referrals;
CREATE POLICY "Allow all for anon ram_referrals" ON ram_referrals
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Class activities tablosu için RLS
ALTER TABLE class_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon class_activities" ON class_activities;
CREATE POLICY "Allow all for anon class_activities" ON class_activities
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Class observations tablosu için RLS
ALTER TABLE class_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon class_observations" ON class_observations;
CREATE POLICY "Allow all for anon class_observations" ON class_observations
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Sociometry tablosu için RLS
ALTER TABLE sociometry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon sociometry" ON sociometry;
CREATE POLICY "Allow all for anon sociometry" ON sociometry
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Goals tablosu için RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon goals" ON goals;
CREATE POLICY "Allow all for anon goals" ON goals
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Parent contacts tablosu için RLS
ALTER TABLE parent_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon parent_contacts" ON parent_contacts;
CREATE POLICY "Allow all for anon parent_contacts" ON parent_contacts
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Settings tablosu için RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon settings" ON settings;
CREATE POLICY "Allow all for anon settings" ON settings
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================
-- İndeksler (Performans için)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_case_notes_student ON case_notes(student_name);
CREATE INDEX IF NOT EXISTS idx_risk_students_status ON risk_students(status);
CREATE INDEX IF NOT EXISTS idx_risk_students_level ON risk_students(risk_level);
CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_ram_referrals_student ON ram_referrals(student_name);
CREATE INDEX IF NOT EXISTS idx_ram_referrals_status ON ram_referrals(status);
CREATE INDEX IF NOT EXISTS idx_class_activities_class ON class_activities(class_key);
CREATE INDEX IF NOT EXISTS idx_class_activities_date ON class_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_parent_contacts_student ON parent_contacts(student_name);
CREATE INDEX IF NOT EXISTS idx_parent_contacts_date ON parent_contacts(contact_date);
CREATE INDEX IF NOT EXISTS idx_goals_year ON goals(academic_year);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(setting_key);

-- Başarılı mesajı
SELECT 'Tüm genişletilmiş tablolar ve RLS politikaları başarıyla oluşturuldu!' as message;
