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