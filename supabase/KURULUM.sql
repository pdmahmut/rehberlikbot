-- =====================================================================
--  RPD Rehberlik Paneli — SIFIRDAN KURULUM
--
--  supabase/migrations/ altindaki gocler birlestirildi. Yeni ve BOS bir
--  Supabase projesinde bir kez calistirilir.
--
--  NOT: Sira dosya numaralarindan biraz farkli. student_incidents ve
--  parent_meeting_requests gecmiste silinip yeniden olusturuldugu icin,
--  bu iki adim 019'dan one alindi; aksi halde 019 olmayan bir tabloya
--  sutun eklemeye calisiyordu.
-- =====================================================================



-- ==================== 001_create_tables.sql ====================

-- =============================================
-- RPD App - Supabase Tablo ve Politika Ayarları
-- =============================================
-- Bu SQL'i Supabase Dashboard > SQL Editor'de çalıştırın

-- 1. referrals tablosu (ana yönlendirme kayıtları)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  teacher_name TEXT,
  class_key TEXT,
  class_display TEXT,
  student_name TEXT NOT NULL,
  reason TEXT,
  note TEXT,
  source TEXT DEFAULT 'web'
);

-- 2. discipline_records tablosunu oluştur (disiplin kayıtları)
CREATE TABLE IF NOT EXISTS discipline_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  class_key TEXT,
  class_display TEXT,
  event_date DATE,
  reason TEXT,
  penalty_type TEXT NOT NULL,
  notes TEXT
);

-- 3. class_students tablosu (sınıf öğrencileri)
CREATE TABLE IF NOT EXISTS class_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  class_key TEXT NOT NULL,
  class_display TEXT,
  student_name TEXT NOT NULL,
  student_number TEXT
);

-- 4. telegram_summaries tablosu (telegram özetleri)
CREATE TABLE IF NOT EXISTS telegram_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  summary_date DATE,
  content TEXT,
  stats JSONB
);

-- =============================================
-- RLS (Row Level Security) Politikaları
-- =============================================

-- referrals tablosu için RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon referrals" ON referrals;
CREATE POLICY "Allow all for anon referrals" ON referrals
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- discipline_records tablosu için RLS
ALTER TABLE discipline_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon discipline" ON discipline_records;
CREATE POLICY "Allow all for anon discipline" ON discipline_records
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- class_students tablosu için RLS
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon class_students" ON class_students;
CREATE POLICY "Allow all for anon class_students" ON class_students
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- telegram_summaries tablosu için RLS
ALTER TABLE telegram_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon telegram" ON telegram_summaries;
CREATE POLICY "Allow all for anon telegram" ON telegram_summaries
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================
-- İndeksler (Performans için)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_referrals_student_name ON referrals(student_name);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discipline_student_name ON discipline_records(student_name);
CREATE INDEX IF NOT EXISTS idx_discipline_created_at ON discipline_records(created_at DESC);

-- Başarılı mesajı
SELECT 'Tüm tablolar ve RLS politikaları başarıyla oluşturuldu!' as message;


-- ==================== 002_create_appointments.sql ====================

-- =============================================
-- RPD App - Randevu (Appointments) Tablosu
-- =============================================
-- Bu SQL'i Supabase Dashboard > SQL Editor'de çalıştırın

-- 1. appointments tablosu (randevular)
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Temel randevu bilgileri
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration INTEGER DEFAULT 15, -- dakika cinsinden (10, 15, 20, 30)
  
  -- Kiminle görüşme
  participant_type TEXT NOT NULL CHECK (participant_type IN ('student', 'parent', 'teacher')),
  participant_name TEXT NOT NULL,
  participant_class TEXT, -- öğrenci/veli için sınıf
  participant_phone TEXT, -- iletişim (opsiyonel)
  
  -- Görüşme detayları
  topic_tags TEXT[] DEFAULT '{}', -- etiketler (devamsızlık, kaygı, vb.)
  location TEXT DEFAULT 'guidance_office' CHECK (location IN ('guidance_office', 'classroom', 'admin', 'phone', 'online', 'other')),
  purpose TEXT, -- görüşmenin hedefi (1 cümle)
  preparation_note TEXT, -- hazırlık notu (opsiyonel)
  
  -- Durum ve öncelik
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'attended', 'not_attended', 'postponed', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  
  -- Görüşme sonrası (kapanış)
  outcome_summary TEXT, -- kısa sonuç (1-2 cümle)
  outcome_decision TEXT[], -- karar/yönlendirme listesi
  next_action TEXT, -- bir sonraki adım
  next_appointment_id UUID REFERENCES appointments(id), -- takip randevusu
  
  -- Hatırlatma
  reminder_sent BOOLEAN DEFAULT FALSE,
  
  -- Şablon bilgisi
  template_type TEXT CHECK (template_type IN ('student', 'parent', 'teacher'))
);

-- 2. appointment_tasks tablosu (randevu görevleri)
CREATE TABLE IF NOT EXISTS appointment_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  task_description TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  due_date DATE
);

-- 3. appointment_templates tablosu (şablonlar)
CREATE TABLE IF NOT EXISTS appointment_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('student', 'parent', 'teacher')),
  default_topic_tags TEXT[] DEFAULT '{}',
  default_duration INTEGER DEFAULT 15,
  default_location TEXT DEFAULT 'guidance_office',
  purpose_template TEXT,
  outcome_options TEXT[] DEFAULT '{}'
);

-- =============================================
-- RLS (Row Level Security) Politikaları
-- =============================================

-- appointments tablosu için RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon appointments" ON appointments;
CREATE POLICY "Allow all for anon appointments" ON appointments
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- appointment_tasks tablosu için RLS
ALTER TABLE appointment_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon appointment_tasks" ON appointment_tasks;
CREATE POLICY "Allow all for anon appointment_tasks" ON appointment_tasks
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- appointment_templates tablosu için RLS
ALTER TABLE appointment_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon appointment_templates" ON appointment_templates;
CREATE POLICY "Allow all for anon appointment_templates" ON appointment_templates
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================
-- İndeksler (Performans için)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_participant ON appointments(participant_name);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointment_tasks_appointment ON appointment_tasks(appointment_id);

-- =============================================
-- Updated_at trigger
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Varsayılan şablonları ekle
-- =============================================
INSERT INTO appointment_templates (template_name, template_type, default_topic_tags, default_duration, default_location, purpose_template, outcome_options)
VALUES 
  ('Öğrenci Görüşmesi', 'student', ARRAY['duygu-durum', 'arkadaşlık', 'ders motivasyonu', 'devamsızlık'], 15, 'guidance_office', 'Öğrenci ile bireysel görüşme', ARRAY['Bilgilendirme yapıldı', 'Takip görüşmesi planlandı', 'Sınıf öğretmeniyle iş birliği', 'Veli bilgilendirilecek']),
  ('Veli Görüşmesi', 'parent', ARRAY['bilgilendirme', 'yönlendirme', 'iş birliği', 'ev ortamı'], 20, 'guidance_office', 'Veli ile bilgilendirme görüşmesi', ARRAY['Bilgilendirme yapıldı', 'Evde uygulanacak öneriler verildi', 'Takip görüşmesi planlandı', 'RAM yönlendirmesi yapıldı']),
  ('Öğretmen Görüşmesi', 'teacher', ARRAY['davranış gözlemi', 'akademik durum', 'sosyal uyum', 'sınıf iklimi'], 15, 'classroom', 'Öğretmen ile öğrenci hakkında görüşme', ARRAY['Sınıf içi müdahale önerildi', 'Gözlem devam edecek', 'Takip kontrolü planlandı', 'İdare bilgilendirildi'])
ON CONFLICT DO NOTHING;

-- Başarılı mesajı
SELECT 'Randevu tabloları ve şablonlar başarıyla oluşturuldu!' as message;


-- ==================== 003_create_extended_tables.sql ====================

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
  category TEXT DEFAULT 'genel' CHECK (category IN ('genel', 'randevu', 'toplanti', 'veli', 'ogretmen', 'rapor', 'diger')),
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
-- 3. ÖĞRENCİ BİLDİRİMLERİ TABLOSU
-- =============================================
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

-- =============================================
-- 4. RİSK TAKİP TABLOSU
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
-- 5. TAKİP HATIRLATICILARI TABLOSU
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
-- 6. RAM YÖNLENDİRME TABLOSU
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
-- 7. SINIF ETKİNLİKLERİ TABLOSU
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

-- Student incidents tablosu için RLS
ALTER TABLE student_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon student_incidents" ON student_incidents;
CREATE POLICY "Allow all for anon student_incidents" ON student_incidents
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
CREATE INDEX IF NOT EXISTS idx_student_incidents_target ON student_incidents(target_student_name);
CREATE INDEX IF NOT EXISTS idx_student_incidents_reporter ON student_incidents(reporter_student_name);
CREATE INDEX IF NOT EXISTS idx_student_incidents_group ON student_incidents(case_group_id);
CREATE INDEX IF NOT EXISTS idx_student_incidents_role ON student_incidents(record_role);
CREATE INDEX IF NOT EXISTS idx_student_incidents_status ON student_incidents(status);
CREATE INDEX IF NOT EXISTS idx_student_incidents_date ON student_incidents(incident_date);
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


-- ==================== 004_add_toplanti_task_category.sql ====================

-- Allow "toplanti" as a valid task category
-- Run this migration against the existing database so new task inserts succeed.

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_category_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_category_check
  CHECK (category IN ('genel', 'randevu', 'toplanti', 'veli', 'ogretmen', 'rapor', 'diger'));


-- ==================== 004_create_appointment_reports.sql ====================

-- =============================================
-- RPD App - Randevu Raporları Tablosu
-- =============================================
-- Bu SQL'i Supabase Dashboard > SQL Editor'de çalıştırın

-- =============================================
-- RANDEVU RAPORLARI TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS appointment_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Randevu bilgileri
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_class TEXT,
  appointment_date DATE,
  
  -- Görüşme notları (kullanıcının girdiği)
  session_notes TEXT,
  
  -- Oluşturulan raporlar (JSON olarak 4 rapor)
  reports JSONB DEFAULT '{}'::jsonb
);

-- Index
CREATE INDEX IF NOT EXISTS idx_appointment_reports_appointment ON appointment_reports(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reports_student ON appointment_reports(student_name);
CREATE INDEX IF NOT EXISTS idx_appointment_reports_date ON appointment_reports(appointment_date);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_appointment_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointment_reports_updated_at ON appointment_reports;
CREATE TRIGGER appointment_reports_updated_at
  BEFORE UPDATE ON appointment_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_appointment_reports_updated_at();

-- RLS Policies
ALTER TABLE appointment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for appointment_reports" ON appointment_reports
  FOR ALL USING (true) WITH CHECK (true);


-- ==================== 005_add_more_task_categories.sql ====================

-- Allow the newer task categories in the tasks table.
-- Run this migration against the existing database so inserts with these values succeed.

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_category_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_category_check
  CHECK (
    category IN (
      'genel',
      'randevu',
      'toplanti',
      'veli',
      'ogretmen',
      'okul-ziyareti',
      'kurum-ziyareti',
      'meslek-tanitimi',
      'rapor',
      'diger'
    )
  );


-- ==================== 005_create_observation_pool.sql ====================

-- =============================================
-- Gözlem Havuzu Tablosu
-- =============================================
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

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

SELECT 'Gözlem havuzu tablosu başarıyla oluşturuldu!' as message;


-- ==================== 005_create_student_incidents.sql ====================

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


-- ==================== 006_add_student_incident_grouping.sql ====================

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


-- ==================== 007_create_parent_meeting_requests.sql ====================

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


-- ==================== 008_create_individual_requests.sql ====================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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


-- ==================== 009_update_time_fields.sql ====================

-- Update time fields to TEXT for lesson slots
-- Change appointments.start_time from TIME to TEXT
-- Change class_activities.activity_time from TIME to TEXT

ALTER TABLE appointments ALTER COLUMN start_time TYPE TEXT;
ALTER TABLE class_activities ALTER COLUMN activity_time TYPE TEXT;

-- ==================== 010_add_source_individual_request_id_to_appointments.sql ====================

-- Store the source individual request on appointments so completion can update the original request.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS source_individual_request_id UUID REFERENCES individual_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_source_individual_request_id
  ON appointments(source_individual_request_id);


-- ==================== 011_add_guidance_application_fields.sql ====================

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



-- ==================== 012_add_class_student_status.sql ====================

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


-- ==================== 013_drop_observation_pool.sql ====================

-- =============================================
-- Gözlem Havuzu Tablosunu Kaldırma
-- =============================================

-- Tabloyu ve ilgili politikaları kaldır
DROP TABLE IF EXISTS observation_pool CASCADE;

SELECT 'Gözlem havuzu tablosu başarıyla kaldırıldı!' as message;

-- ==================== 014_drop_parent_meeting_requests.sql ====================

-- =============================================
-- Veli Talepleri Tablosunu Kaldırma
-- =============================================

-- Tabloyu ve ilgili politikaları kaldır
DROP TABLE IF EXISTS parent_meeting_requests CASCADE;

SELECT 'Veli talepleri tablosu başarıyla kaldırıldı!' as message;

-- ==================== 015_drop_individual_requests.sql ====================

-- =============================================
-- Bireysel Başvurular Tablosunu Kaldırma
-- =============================================

-- Önce foreign key constraint'ini kaldır (eğer varsa)
ALTER TABLE appointments DROP COLUMN IF EXISTS source_individual_request_id;

-- Tabloyu ve ilgili politikaları kaldır
DROP TABLE IF EXISTS individual_requests CASCADE;

SELECT 'Bireysel başvurular tablosu başarıyla kaldırıldı!' as message;

-- ==================== 016_drop_student_incidents.sql ====================

-- =============================================
-- Öğrenci Bildirimleri Tablosunu Kaldırma
-- =============================================

-- Tabloyu ve ilgili politikaları kaldır
DROP TABLE IF EXISTS student_incidents CASCADE;

SELECT 'Öğrenci bildirimleri tablosu başarıyla kaldırıldı!' as message;

-- ==================== 017_recreate_observation_pool.sql ====================

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

-- ==================== 018_recreate_individual_requests.sql ====================

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

-- ==================== 024_recreate_student_incidents.sql ====================

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


-- ==================== 024b_create_missing_tables.sql ====================

-- Goc dosyalarinda eksik kalan alti tabloyu olusturur.
--
-- Bu tablolar canli veritabaninda vardi ama hicbir goc dosyasi onlari
-- olusturmuyordu; anlasilan Supabase panelinden elle eklenmisler. Sonuc
-- olarak sifirdan kurulum yapmak mumkun degildi: 025 numarali goc
-- parent_meeting_requests tablosunu bulamayip duruyordu.
--
--   guidance_topics          rehberlik konulari
--   guidance_plans           sinif rehberligi planlari (konulara bagli)
--   lesson_hours             okulun ders saatleri
--   parent_meeting_requests  veli talepleri (007'de olusturulup 014'te
--                            silinmis, bir daha olusturulmamisti)
--   class_requests           ogretmenlerin sinif rehberligi talepleri
--   teacher_users            ogretmen giris hesaplari
--
-- Tanimlar canli veritabanindan birebir cikarildi: sutunlar, varsayilanlar,
-- kisitlar, indeksler. 025 ve 029 numarali gocler bu tablolarin guvenligini
-- ayrica ayarliyor; yine de burada da aciliyor ki dosya kendi basina tutarli
-- olsun.

-- --------------------------------------------------------------- konular
CREATE TABLE IF NOT EXISTS public.guidance_topics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  title        text NOT NULL,
  grade_levels integer[] NOT NULL DEFAULT '{}'::integer[],
  status       text DEFAULT 'active'::text
               CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text])),
  notes        text,
  school_year  text DEFAULT '2025-2026'::text
);

-- --------------------------------------------------------------- planlar
CREATE TABLE IF NOT EXISTS public.guidance_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  topic_id      uuid REFERENCES public.guidance_topics(id) ON DELETE CASCADE,
  class_key     text NOT NULL,
  class_display text NOT NULL,
  status        text DEFAULT 'unplanned'::text
                CHECK (status = ANY (ARRAY['unplanned'::text, 'planned'::text, 'completed'::text])),
  plan_date     date,
  lesson_period integer CHECK (lesson_period >= 1 AND lesson_period <= 7),
  completed_at  timestamptz,
  teacher_name  text
);

CREATE INDEX IF NOT EXISTS idx_guidance_plans_topic  ON public.guidance_plans (topic_id);
CREATE INDEX IF NOT EXISTS idx_guidance_plans_class  ON public.guidance_plans (class_key);
CREATE INDEX IF NOT EXISTS idx_guidance_plans_status ON public.guidance_plans (status);
CREATE INDEX IF NOT EXISTS idx_guidance_plans_date   ON public.guidance_plans (plan_date);

-- Ayni tarih ve ders saatine iki PLANLI kayit konamaz. Kisit kismidir:
-- tamamlanmis veya planlanmamis kayitlar bu kurala girmez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_guidance_plans_conflict
  ON public.guidance_plans (plan_date, lesson_period)
  WHERE status = 'planned'::text;

-- ---------------------------------------------------------- ders saatleri
CREATE TABLE IF NOT EXISTS public.lesson_hours (
  id            serial PRIMARY KEY,
  period_number integer NOT NULL UNIQUE,
  start_time    text NOT NULL,
  end_time      text NOT NULL,
  updated_at    timestamptz DEFAULT now()
);

-- Okulun zil saatleri. Ogrenci verisi degil, yil boyunca degismeyen ayardir.
INSERT INTO public.lesson_hours (period_number, start_time, end_time) VALUES
  (1, '07:20', '07:55'),
  (2, '08:05', '08:40'),
  (3, '08:50', '09:25'),
  (4, '09:35', '10:10'),
  (5, '10:20', '10:55'),
  (6, '11:05', '11:40'),
  (7, '11:50', '12:25')
ON CONFLICT (period_number) DO NOTHING;

-- ---------------------------------------------------------- veli talepleri
CREATE TABLE IF NOT EXISTS public.parent_meeting_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  student_name      text NOT NULL,
  class_key         text,
  class_display     text,
  parent_name       text,
  parent_relation   text,
  parent_phone      text,
  request_type      text DEFAULT 'gorusme'::text
                    CHECK (request_type = ANY (ARRAY['gorusme'::text, 'bilgilendirme'::text, 'destek'::text, 'acil'::text, 'diger'::text])),
  subject           text NOT NULL,
  detail            text NOT NULL,
  status            text DEFAULT 'new'::text
                    CHECK (status = ANY (ARRAY['new'::text, 'reviewing'::text, 'scheduled'::text, 'closed'::text])),
  preferred_contact text,
  note              text,
  request_date      date
);

CREATE INDEX IF NOT EXISTS idx_parent_meeting_requests_student    ON public.parent_meeting_requests (student_name);
CREATE INDEX IF NOT EXISTS idx_parent_meeting_requests_status     ON public.parent_meeting_requests (status);
CREATE INDEX IF NOT EXISTS idx_parent_meeting_requests_created_at ON public.parent_meeting_requests (created_at);


-- ------------------------------------------------------- sinif talepleri
CREATE TABLE IF NOT EXISTS public.class_requests (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz,
  class_key                 text NOT NULL,
  class_display             text NOT NULL,
  teacher_name              text NOT NULL,
  topic                     text,
  description               text,
  teacher_description       text,
  admin_category            text,
  admin_category_normalized text,
  status                    text NOT NULL DEFAULT 'pending'::text
                            CHECK (status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'completed'::text, 'rejected'::text])),
  scheduled_date            date,
  lesson_slot               integer,
  lesson_teacher            text,
  feedback                  text
);

CREATE INDEX IF NOT EXISTS idx_class_requests_admin_category_normalized
  ON public.class_requests (admin_category_normalized);

-- --------------------------------------------------- ogretmen giris hesaplari
CREATE TABLE IF NOT EXISTS public.teacher_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz DEFAULT now(),
  username        text NOT NULL UNIQUE,
  teacher_name    text,
  class_key       text,
  class_display   text,
  password_cipher text,
  password_lookup text
);

-- Ayni sifre iki ogretmene verilemez: giris yalnizca sifreyle yapildigi icin
-- sifrenin kimi isaret ettigi tekil olmali. NULL olanlar kurala girmez.
CREATE UNIQUE INDEX IF NOT EXISTS teacher_users_password_lookup_key
  ON public.teacher_users (password_lookup)
  WHERE password_lookup IS NOT NULL;

-- ------------------------------------------------------------------ guvenlik
-- Altisi da yalnizca sunucudan erisilir. Politika tanimlanmaz: RLS acik ve
-- zorunlu, politika yok demek, service_role disinda kimse okuyamaz demektir.
ALTER TABLE public.guidance_topics          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guidance_topics          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.guidance_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guidance_plans           FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.lesson_hours             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_hours             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.parent_meeting_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_meeting_requests  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.class_requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_requests           FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.teacher_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_users            FORCE  ROW LEVEL SECURITY;


-- ==================== 019_add_application_status_fields.sql ====================

-- Başvuru durumları için status alanları ekleme

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Bekliyor' CHECK (status IN ('Bekliyor', 'Görüşüldü', 'Randevu verildi'));

ALTER TABLE parent_meeting_requests
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Bekliyor' CHECK (status IN ('Bekliyor', 'Görüşüldü', 'Randevu verildi'));

ALTER TABLE individual_requests
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Bekliyor' CHECK (status IN ('Bekliyor', 'Görüşüldü', 'Randevu verildi'));

ALTER TABLE student_incidents
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Bekliyor' CHECK (status IN ('Bekliyor', 'Görüşüldü', 'Randevu verildi'));

ALTER TABLE observation_pool
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Bekliyor' CHECK (status IN ('Bekliyor', 'Görüşüldü', 'Randevu verildi'));

SELECT 'Başvuru tablosuna status alanları eklendi!' as message;

-- ==================== 020_enable_class_requests_rls.sql ====================

CREATE OR REPLACE FUNCTION public.app_request_header(header_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (COALESCE(current_setting('request.headers', true), '{}')::jsonb ->> lower(header_name)),
    ''
  );
$$;

ALTER TABLE public.class_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_requests_select_policy ON public.class_requests;
DROP POLICY IF EXISTS class_requests_insert_policy ON public.class_requests;
DROP POLICY IF EXISTS class_requests_update_policy ON public.class_requests;
DROP POLICY IF EXISTS class_requests_delete_policy ON public.class_requests;

CREATE POLICY class_requests_select_policy
ON public.class_requests
FOR SELECT
USING (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND (
      public.app_request_header('x-class-key') = ''
      OR class_key = public.app_request_header('x-class-key')
    )
  )
);

CREATE POLICY class_requests_insert_policy
ON public.class_requests
FOR INSERT
WITH CHECK (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND class_key = public.app_request_header('x-class-key')
    AND status = 'pending'
  )
);

CREATE POLICY class_requests_update_policy
ON public.class_requests
FOR UPDATE
USING (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND status = 'pending'
  )
)
WITH CHECK (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND class_key = public.app_request_header('x-class-key')
    AND status = 'pending'
  )
);

CREATE POLICY class_requests_delete_policy
ON public.class_requests
FOR DELETE
USING (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND status = 'pending'
  )
);


-- ==================== 021_class_request_hybrid_flow.sql ====================

CREATE TABLE IF NOT EXISTS public.class_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  teacher_name TEXT NOT NULL,
  class_key TEXT NOT NULL,
  class_display TEXT NOT NULL,
  topic TEXT,
  description TEXT,
  teacher_description TEXT,
  admin_category TEXT,
  admin_category_normalized TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'rejected')),
  scheduled_date DATE,
  lesson_slot INTEGER,
  lesson_teacher TEXT,
  feedback TEXT
);

ALTER TABLE public.class_requests
  ALTER COLUMN topic DROP NOT NULL;

ALTER TABLE public.class_requests
  ADD COLUMN IF NOT EXISTS teacher_description TEXT,
  ADD COLUMN IF NOT EXISTS admin_category TEXT,
  ADD COLUMN IF NOT EXISTS admin_category_normalized TEXT,
  ADD COLUMN IF NOT EXISTS lesson_teacher TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.class_request_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  label TEXT NOT NULL,
  normalized_label TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_class_requests_admin_category_normalized
  ON public.class_requests (admin_category_normalized);

CREATE INDEX IF NOT EXISTS idx_class_request_categories_normalized_label
  ON public.class_request_categories (normalized_label);

UPDATE public.class_requests
SET teacher_description = NULLIF(BTRIM(description), '')
WHERE teacher_description IS NULL
  AND description IS NOT NULL;

UPDATE public.class_requests
SET admin_category = NULLIF(BTRIM(topic), '')
WHERE admin_category IS NULL
  AND topic IS NOT NULL;

UPDATE public.class_requests
SET admin_category_normalized = LOWER(REGEXP_REPLACE(BTRIM(admin_category), '\s+', ' ', 'g'))
WHERE admin_category IS NOT NULL
  AND (
    admin_category_normalized IS NULL
    OR admin_category_normalized = ''
  );

INSERT INTO public.class_request_categories (label, normalized_label)
SELECT category_seed.label, category_seed.normalized_label
FROM (
  SELECT DISTINCT ON (LOWER(REGEXP_REPLACE(BTRIM(admin_category), '\s+', ' ', 'g')))
    BTRIM(admin_category) AS label,
    LOWER(REGEXP_REPLACE(BTRIM(admin_category), '\s+', ' ', 'g')) AS normalized_label
  FROM public.class_requests
  WHERE admin_category IS NOT NULL
    AND BTRIM(admin_category) <> ''
  ORDER BY LOWER(REGEXP_REPLACE(BTRIM(admin_category), '\s+', ' ', 'g')), created_at
) AS category_seed
ON CONFLICT (normalized_label) DO NOTHING;

ALTER TABLE public.class_request_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_request_categories_select_policy ON public.class_request_categories;
DROP POLICY IF EXISTS class_request_categories_insert_policy ON public.class_request_categories;
DROP POLICY IF EXISTS class_request_categories_update_policy ON public.class_request_categories;
DROP POLICY IF EXISTS class_request_categories_delete_policy ON public.class_request_categories;

CREATE POLICY class_request_categories_select_policy
ON public.class_request_categories
FOR SELECT
USING (public.app_request_header('x-app-role') = 'admin');

CREATE POLICY class_request_categories_insert_policy
ON public.class_request_categories
FOR INSERT
WITH CHECK (public.app_request_header('x-app-role') = 'admin');

CREATE POLICY class_request_categories_update_policy
ON public.class_request_categories
FOR UPDATE
USING (public.app_request_header('x-app-role') = 'admin')
WITH CHECK (public.app_request_header('x-app-role') = 'admin');

CREATE POLICY class_request_categories_delete_policy
ON public.class_request_categories
FOR DELETE
USING (public.app_request_header('x-app-role') = 'admin');


-- ==================== 022_allow_teacher_feedback_on_completed_class_requests.sql ====================

DROP POLICY IF EXISTS class_requests_update_policy ON public.class_requests;

CREATE POLICY class_requests_update_policy
ON public.class_requests
FOR UPDATE
USING (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND status IN ('pending', 'completed')
  )
)
WITH CHECK (
  public.app_request_header('x-app-role') = 'admin'
  OR (
    public.app_request_header('x-app-role') = 'teacher'
    AND teacher_name = public.app_request_header('x-teacher-name')
    AND class_key = public.app_request_header('x-class-key')
    AND status IN ('pending', 'completed')
  )
);


-- ==================== 023_teacher_password_uniqueness_history.sql ====================

CREATE TABLE IF NOT EXISTS public.teacher_password_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  teacher_user_id UUID NOT NULL REFERENCES public.teacher_users(id) ON DELETE CASCADE,
  normalized_password TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_password_history_unique_normalized
  ON public.teacher_password_history (normalized_password);

CREATE INDEX IF NOT EXISTS idx_teacher_password_history_teacher_user_id
  ON public.teacher_password_history (teacher_user_id);

ALTER TABLE public.teacher_users
  ADD CONSTRAINT teacher_users_password_min_length_check
  CHECK (password_hash IS NULL OR char_length(BTRIM(password_hash)) >= 4);

WITH normalized_passwords AS (
  SELECT
    id,
    LOWER(BTRIM(password_hash)) AS normalized_password,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM(password_hash))
      ORDER BY created_at, id
    ) AS row_num
  FROM public.teacher_users
  WHERE password_hash IS NOT NULL
    AND BTRIM(password_hash) <> ''
)
UPDATE public.teacher_users tu
SET password_hash = CONCAT(BTRIM(tu.password_hash), '_', SUBSTRING(tu.id::text, 1, 4))
FROM normalized_passwords np
WHERE tu.id = np.id
  AND np.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_users_password_unique_normalized
  ON public.teacher_users ((LOWER(BTRIM(password_hash))))
  WHERE password_hash IS NOT NULL AND BTRIM(password_hash) <> '';

INSERT INTO public.teacher_password_history (teacher_user_id, normalized_password)
SELECT tu.id, LOWER(BTRIM(tu.password_hash))
FROM public.teacher_users tu
WHERE tu.password_hash IS NOT NULL
  AND BTRIM(tu.password_hash) <> ''
ON CONFLICT (normalized_password) DO NOTHING;


-- ==================== 025_lock_down_server_only_tables.sql ====================

-- 025: Sunucu-only tablolari anon erisimine tamamen kapat.
--
-- Bu tablolara tarayicidan (anon key ile) HIC erisilmiyor; yalnizca
-- API route'lari uzerinden service_role ile okunup yaziliyor.
-- Bu yuzden RLS acilip TUM anon policy'leri kaldiriliyor.
-- service_role RLS'i bypass ettigi icin uygulama calismaya devam eder.
--
-- ON KOSUL: SUPABASE_SERVICE_ROLE_KEY ortam degiskeni tanimli olmali ve
-- guncel kod deploy edilmis olmali. Aksi halde giris/ogretmen yonetimi kirilir.

DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'teacher_users',
    'teacher_password_history',
    'class_students',
    'lesson_hours',
    'deletion_requests',
    'appointment_tasks',
    'discipline_records'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      RAISE NOTICE 'atlandi (tablo yok): %', t;
      CONTINUE;
    END IF;

    -- Mevcut tum policy'leri kaldir (hepsi anon'a acik "allow all" policy'leri)
    FOR p IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      RAISE NOTICE 'policy kaldirildi: %.%', t, p.policyname;
    END LOOP;

    -- RLS'i ac ve tablo sahibi icin de zorunlu kil
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

    -- anon ve authenticated rollerinden tablo yetkilerini geri al
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);

    RAISE NOTICE 'kilitlendi: %', t;
  END LOOP;
END $$;

-- Dogrulama: asagidaki sorgu her tablo icin rls_enabled = true ve policy_count = 0 vermeli.
--
--   SELECT c.relname          AS tablo,
--          c.relrowsecurity   AS rls_enabled,
--          c.relforcerowsecurity AS rls_forced,
--          (SELECT count(*) FROM pg_policies p
--             WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
--     FROM pg_class c
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relname IN ('teacher_users','teacher_password_history','class_students',
--                        'lesson_hours','deletion_requests','appointment_tasks','discipline_records')
--    ORDER BY 1;


-- ==================== 026_auth_hardening.sql ====================

-- 026: Kimlik dogrulama semasinin yeniden yapilandirilmasi.
--
-- Degisiklikler:
--   1. teacher_users: duz metin sifre -> kor indeks (lookup) + sifreli saklama (cipher)
--   2. teacher_password_history: duz metin -> kor indeks
--   3. app_settings: yonetici sifresi (hash'li) icin. Onceden var/admin-password.json
--      icinde duz metin tutuluyordu ve Vercel'de kalici degildi.
--   4. login_attempts: kaba kuvvet sinirlamasi icin
--
-- UYARI: Mevcut ogretmen hesaplari ve sifreleri SILINIR. Sifreler geri
-- donusturulemez bicimde yeniden uretilecegi icin tasima yapilmaz.
-- Yil basi hesap olusturma akisindan yeniden uretin.
--
-- ON KOSUL: PASSWORD_SECRET ve SESSION_SECRET ortam degiskenleri tanimli olmali.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. teacher_users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  teacher_name TEXT NOT NULL,
  class_key TEXT,
  class_display TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eski duz metin sifre kolonu ve verisi kaldiriliyor
TRUNCATE TABLE public.teacher_users CASCADE;
ALTER TABLE public.teacher_users DROP COLUMN IF EXISTS password_hash;

ALTER TABLE public.teacher_users
  ADD COLUMN IF NOT EXISTS password_lookup TEXT,
  ADD COLUMN IF NOT EXISTS password_cipher TEXT;

-- Sadece-sifre girisi: ayni sifre iki hesapta olamaz
CREATE UNIQUE INDEX IF NOT EXISTS teacher_users_password_lookup_key
  ON public.teacher_users (password_lookup)
  WHERE password_lookup IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. teacher_password_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_password_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_user_id UUID REFERENCES public.teacher_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

TRUNCATE TABLE public.teacher_password_history;
ALTER TABLE public.teacher_password_history DROP COLUMN IF EXISTS normalized_password;
ALTER TABLE public.teacher_password_history
  ADD COLUMN IF NOT EXISTS password_lookup TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS teacher_password_history_lookup_idx
  ON public.teacher_password_history (password_lookup);

-- ---------------------------------------------------------------------------
-- 3. app_settings  (yonetici sifresi hash'i burada)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. login_attempts  (kaba kuvvet sinirlamasi)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip TEXT NOT NULL,
  role TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_attempts_ip_time_idx
  ON public.login_attempts (ip, attempted_at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_time_idx
  ON public.login_attempts (attempted_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Hepsini anon erisimine kapat (yalnizca service_role erisir)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'teacher_users',
    'teacher_password_history',
    'app_settings',
    'login_attempts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

COMMIT;

-- Dogrulama:
--   SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
--          (SELECT count(*) FROM pg_policies p
--            WHERE p.schemaname='public' AND p.tablename=c.relname) AS policies
--     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--    WHERE n.nspname='public'
--      AND c.relname IN ('teacher_users','teacher_password_history','app_settings','login_attempts');
--
-- Beklenen: relrowsecurity=t, relforcerowsecurity=t, policies=0


-- ==================== 027_move_file_stores_to_db.sql ====================

-- 027: Disk dosyalarinda tutulan verileri veritabanina tasi.
--
-- Sorun: var/*.json dosyalari Vercel'in gecici dosya sisteminde duruyordu.
-- Canlida yapilan degisiklikler (ogretmen ekleme, sinif talebi, bildirim
-- okundu isareti) her deploy'da veya sunucu yeniden basladiginda kayboluyordu.
--
-- Bu migration yalnizca tablolari OLUSTURUR. Mevcut JSON verisini tasimak icin
-- migration sonrasi `node scripts/import-file-stores.mjs` calistirilmalidir.

BEGIN;

-- ---------------------------------------------------------------------------
-- teachers  (kaynak: var/teachers.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teachers (
  teacher_id TEXT PRIMARY KEY,
  teacher_name TEXT NOT NULL,
  teacher_name_normalized TEXT NOT NULL,
  sinif_sube_key TEXT,
  sinif_sube_display TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ayni ogretmen iki kez eklenemesin
CREATE UNIQUE INDEX IF NOT EXISTS teachers_name_normalized_key
  ON public.teachers (teacher_name_normalized);

-- Sinifa gore arama icin. UNIQUE degil: sinif bir ogretmenden digerine
-- devredilirken toplu guncelleme sirasinda gecici cakisma olusabiliyor.
-- Tek rehber ogretmen kurali uygulama katmaninda (assignTeacherToClass) saglaniyor.
CREATE INDEX IF NOT EXISTS teachers_sinif_sube_key_idx
  ON public.teachers (sinif_sube_key)
  WHERE sinif_sube_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- class_student_requests  (kaynak: var/class-student-requests.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_student_requests (
  id TEXT PRIMARY KEY,
  teacher_name TEXT NOT NULL,
  class_key TEXT NOT NULL,
  class_display TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_value TEXT,
  request_type TEXT NOT NULL CHECK (request_type IN ('delete', 'class_change')),
  new_class_key TEXT,
  new_class_display TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS class_student_requests_status_idx
  ON public.class_student_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS class_student_requests_class_idx
  ON public.class_student_requests (class_key);

-- ---------------------------------------------------------------------------
-- admin_notification_states  (kaynak: var/admin-notification-states.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_notification_states (
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  viewer_role TEXT NOT NULL DEFAULT 'admin',
  read_at TIMESTAMPTZ,
  popup_seen_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_type, source_id, viewer_role)
);

-- ---------------------------------------------------------------------------
-- Hepsini anon erisimine kapat (yalnizca API rotalari uzerinden erisilecek)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'teachers',
    'class_student_requests',
    'admin_notification_states'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

COMMIT;


-- ==================== 028_fix_class_students_columns.sql ====================

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


-- ==================== 029_lock_down_student_data_tables.sql ====================

-- 029: Ogrenci verisi tutan tablolari anon erisimine kapat.
--
-- Bu tablolar panel sayfalarindan tarayici uzerinden DOGRUDAN okunuyordu.
-- Supabase anon anahtari tarayicida gorunur oldugu icin, uygulamayi hic
-- kullanmadan ogrenci isimleri ve ozel nitelikli kayitlar (akran zorbaligi,
-- multeci/gocmen, maddi durum, oksuz/yetim) okunabiliyordu.
--
-- Artik tum sorgular /api/db gecidinden gecer: oturum dogrulanir, tablo ve
-- islem izni kontrol edilir, ogretmen sorgularina sinif filtresi zorla
-- eklenir ve sorgu service_role ile calistirilir.
--
-- ON KOSUL: gecidi kullanan kod (dbClient + /api/db) deploy edilmis olmali.

DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'referrals',
    'observation_pool',
    'individual_requests',
    'parent_meeting_requests',
    'student_incidents',
    'appointments',
    'guidance_plans',
    'guidance_topics',
    'tasks',
    'follow_ups',
    'class_activities',
    'work_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      RAISE NOTICE 'atlandi (tablo yok): %', t;
      CONTINUE;
    END IF;

    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);

    RAISE NOTICE 'kilitlendi: %', t;
  END LOOP;
END $$;


-- ==================== 030_lock_down_class_requests.sql ====================

-- 030: class_requests ve class_request_categories tablolarini anon erisimine kapat.
--
-- Onceki durum (migration 020-022): bu tablolarda RLS vardi, ancak politikalar
-- HTTP basliklarina bakiyordu:
--
--     public.app_request_header('x-app-role') = 'admin'
--
-- Basliklari sunucu ekliyordu, ama anon anahtar tarayicida gorunur oldugu icin
-- herhangi biri kendi istegine "x-app-role: admin" basligini koyup yonetici
-- gibi davranabiliyordu. Yani RLS vardi fakat gercek bir sinir degildi.
--
-- Yeni durum: rotalar service_role kullaniyor, ogretmen kisitlari (kendi
-- talebi / kendi sinifi) API kodunda uygulaniyor. Tablolar anon erisimine
-- tamamen kapatiliyor ve baslik tabanli politikalar kaldiriliyor.
--
-- ON KOSUL: guncel kod deploy edilmis olmali.

BEGIN;

DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY['class_requests', 'class_request_categories'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      RAISE NOTICE 'atlandi (tablo yok): %', t;
      CONTINUE;
    END IF;

    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      RAISE NOTICE 'policy kaldirildi: %.%', t, p.policyname;
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);

    RAISE NOTICE 'kilitlendi: %', t;
  END LOOP;
END $$;

-- Baslik okuyan yardimci fonksiyon artik kullanilmiyor.
DROP FUNCTION IF EXISTS public.app_request_header(TEXT);

COMMIT;


-- ==================== 031_create_classes_table.sql ====================

-- 031: Sinif listesini veritabanina tasi.
--
-- Onceki durum: sinif listesi (5A, 5B, ... ) data.json dosyasinda sabitti.
-- Yeni bir sube acmak (ornegin 5D) dosyayi elle duzenleyip yeniden deploy
-- etmeyi gerektiriyordu. Artik sinif listesi PDF yuklemesinden olusuyor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.classes (
  class_key TEXT PRIMARY KEY,
  class_display TEXT NOT NULL,
  grade INTEGER,
  section TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS classes_sort_idx ON public.classes (sort_order, class_key);

-- Ogrenci yukleme islemlerinin kaydi (ne zaman, kim, kac kayit)
CREATE TABLE IF NOT EXISTS public.student_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT,
  mode TEXT NOT NULL,
  class_count INTEGER NOT NULL DEFAULT 0,
  student_count INTEGER NOT NULL DEFAULT 0,
  removed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Anon erisimine kapali: yalnizca API rotalari uzerinden erisilir
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['classes', 'student_imports'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

COMMIT;


-- ==================== 032_drop_unused_tables.sql ====================

-- 032: Kodun hicbir yerinde kullanilmayan tablolari kaldir.
--
-- Bu tablolar migration'larda olusturulmus ancak uygulama koduna hic
-- baglanmamis. Bir kismi yarim kalmis ozelliklerden, bir kismi da
-- kaldirilmis entegrasyonlardan (Telegram) arta kalmis.
--
-- Kaldirilmadan once kodda referans aramasi yapildi; hicbirine erisim yok.

BEGIN;

-- Bos tablolar (0 kayit)
DROP TABLE IF EXISTS public.telegram_summaries CASCADE;   -- Telegram entegrasyonu kaldirilmisti
DROP TABLE IF EXISTS public.appointment_reports CASCADE;
DROP TABLE IF EXISTS public.case_notes CASCADE;
DROP TABLE IF EXISTS public.class_observations CASCADE;
DROP TABLE IF EXISTS public.goals CASCADE;
DROP TABLE IF EXISTS public.parent_contacts CASCADE;
DROP TABLE IF EXISTS public.ram_referrals CASCADE;
DROP TABLE IF EXISTS public.risk_students CASCADE;
DROP TABLE IF EXISTS public.sociometry CASCADE;

-- Icinde veri olan ama kod tarafindan hic okunmayan tablolar.
-- Kullanici onayiyla kaldiriliyor.
--
-- appointment_templates (3 kayit): "Ogrenci Gorusmesi", "Veli Gorusmesi",
--   "Ogretmen Gorusmesi" sablonlari. Hicbir ekran kullanmiyordu.
DROP TABLE IF EXISTS public.appointment_templates CASCADE;

-- settings (22 kayit): belge uretimi icin dusunulmus ama hicbir kod
--   tarafindan okunmayan yapilandirma. Ileride gerekirse degerler:
--     school_name      = "DUMLUPINAR ORTAOKULU"
--     academic_year    = "2025-2026"
--     document_header  = "DUMLUPINAR ORTAOKULU / REHBERLIK SERVISI"
--     signature_text   = danisman adi ve unvani
--   Bu bilgiler gerekirse elle yeniden girilebilir.
DROP TABLE IF EXISTS public.settings CASCADE;

COMMIT;

-- Dogrulama: asagidaki sorgu hicbir satir dondurmemeli.
--   SELECT tablename FROM pg_tables
--    WHERE schemaname='public'
--      AND tablename IN ('telegram_summaries','appointment_reports','case_notes',
--                        'class_observations','goals','parent_contacts','ram_referrals',
--                        'risk_students','sociometry','appointment_templates','settings');


-- ==================== 033_apply_missing_columns.sql ====================

-- 033: Yazilmis ama veritabanina hic uygulanmamis kolonlari tamamla.
--
-- Migration 010, 011 ve 019 depoda duruyor fakat uzaktaki veritabanina
-- uygulanmamis. Kod bu kolonlari kullanmak uzere yazildigi icin, kolonlar
-- olmayinca sessizce yedek yollara dusuyordu:
--
--   - Randevu, kaynagi olan basvuruya (yonlendirme/veli talebi/olay) hic
--     baglanmiyordu. Bu yuzden gorusme tamamlandiginda kaynak basvurunun
--     durumu guncellenemiyordu; "Gorusme Sonucu" surekli bos kaliyordu.
--   - referrals tablosunda status kolonu yoktu; basvuru durumu yalnizca
--     isim eslestirmesiyle ekranda hesaplaniyordu.
--
-- Yalnizca GERCEKTEN eksik olanlar ekleniyor. Diger tablolarda status
-- kolonu zaten mevcut, onlara dokunulmuyor.

BEGIN;

-- ---------------------------------------------------------------------------
-- appointments: kaynak basvuru baglantisi  (migration 010 + 011)
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS source_application_type TEXT,
  ADD COLUMN IF NOT EXISTS source_application_id TEXT,
  ADD COLUMN IF NOT EXISTS source_individual_request_id UUID;

CREATE INDEX IF NOT EXISTS idx_appointments_source_application
  ON public.appointments (source_application_type, source_application_id);

CREATE INDEX IF NOT EXISTS idx_appointments_source_individual_request
  ON public.appointments (source_individual_request_id);

-- ---------------------------------------------------------------------------
-- referrals: basvuru durumu  (migration 019)
-- ---------------------------------------------------------------------------
-- Kodun yazdigi degerler (guidanceApplications.ts / teacher_referral):
--   "Bekliyor", "Randevu verildi", "Görüşüldü"
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Bekliyor';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_status_check') THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_status_check
      CHECK (status IN ('Bekliyor', 'Görüşüldü', 'Randevu verildi'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals (status);

-- ---------------------------------------------------------------------------
-- observation_pool: kaynak takibi  (migration 011)
-- ---------------------------------------------------------------------------
ALTER TABLE public.observation_pool
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'observation',
  ADD COLUMN IF NOT EXISTS source_record_id TEXT,
  ADD COLUMN IF NOT EXISTS source_record_table TEXT;

UPDATE public.observation_pool
   SET source_type = 'observation'
 WHERE source_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observation_pool_source_type_check') THEN
    ALTER TABLE public.observation_pool
      ADD CONSTRAINT observation_pool_source_type_check
      CHECK (source_type IN ('observation', 'student_report', 'teacher_referral',
                             'parent_request', 'self_application'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_observation_pool_source
  ON public.observation_pool (source_type, source_record_id);

COMMIT;


-- ==================== 034_student_follow_up.sql ====================

-- 034: Ogrenci bazli "aktif takip" alanlari.
--
-- Onceki durum: "Aktif Takip" yalnizca bir gorusmenin sonucuna yazilan
-- etiketti. Ogrenciye ait kalici bir bilgi degildi; ayni ogrenci icin yeni
-- bir basvuru geldiginde onceki takiple hicbir baglantisi olmayan yeni bir
-- satir olusuyordu. Rehber ogretmen ise ogrenciyi takip ediyor, basvuruyu
-- degil.
--
-- class_students.status alani zaten 'aktif_takip' degerini destekliyordu
-- ancak hicbir kod bu degeri yazmiyordu. Artik takip isareti burada.
--
-- Sonraki gorusme tarihi BILEREK saklanmiyor: o bilgi appointments
-- tablosunda zaten var. Iki yerde tutmak birinin bayatlamasi demek olurdu.

BEGIN;

ALTER TABLE public.class_students
  ADD COLUMN IF NOT EXISTS follow_up_reason TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_since DATE,
  ADD COLUMN IF NOT EXISTS follow_up_note TEXT;

-- Takipteki ogrencileri hizli listelemek icin
CREATE INDEX IF NOT EXISTS class_students_follow_up_idx
  ON public.class_students (status)
  WHERE status = 'aktif_takip';

COMMIT;

-- Dogrulama:
--   SELECT status, count(*) FROM public.class_students GROUP BY status;


-- ==================== 035_drop_discipline.sql ====================

-- Disiplin ozelligini tamamen kaldirir.
--
-- Disiplin ekrani Nisan 2026'da silinmisti; arkasindaki API rotasi, grafik
-- bileseni ve tip tanimlari da kaldirildi. Geriye yalnizca tablo kalmisti.
-- Rehberlik servisi disiplin takibi yapmiyor, bu tablo kullanilmiyor.
--
-- Tablo bagimsizdir: baska hicbir tablodan ona foreign key yoktur, bu yuzden
-- dusurmek diger verileri etkilemez.

-- Once emin olalim: icinde kayit varsa migration durur ve uyarir.
DO $$
DECLARE
  kayit_sayisi INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'discipline_records') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.discipline_records' INTO kayit_sayisi;
    IF kayit_sayisi > 0 THEN
      RAISE EXCEPTION 'discipline_records tablosunda % kayit var. Silmeden once inceleyin.', kayit_sayisi;
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS public.discipline_records CASCADE;


-- ==================== 036_drop_unused_request_tables.sql ====================

-- Kullanilmayan uc tabloyu dusurur.
--
-- Bu tablolarin API rotalari ve ekranlari kaldirildi:
--
--   deletion_requests  -> ogrencinin listeden silinmesi talebi.
--                         Ayni isi class_student_requests yapiyor ve
--                         "Sinif Talepleri" ekrani onu kullaniyor.
--   work_requests      -> ogretmenin sinif rehberligi talebi.
--                         Ayni isi class_requests yapiyor ve Sinif
--                         Rehberligi / Sinifim / Programim ekranlari
--                         onu kullaniyor.
--   appointment_tasks  -> randevuya bagli yapilacaklar listesi.
--                         Ekrani (zaman sayfasi) Nisan 2026'da silinmisti.
--
-- Koddaki son baglar da kaldirildi: randevu silinirken calisan
-- appointment_tasks temizligi ve takvimdeki work_requests guncellemesi.

DO $$
DECLARE
  t TEXT;
  n INTEGER;
BEGIN
  FOREACH t IN ARRAY ARRAY['deletion_requests', 'work_requests', 'appointment_tasks'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION '% tablosunda % kayit var. Silmeden once inceleyin.', t, n;
      END IF;
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.deletion_requests CASCADE;
DROP TABLE IF EXISTS public.work_requests CASCADE;
DROP TABLE IF EXISTS public.appointment_tasks CASCADE;
