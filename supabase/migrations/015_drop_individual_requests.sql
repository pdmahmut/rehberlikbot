-- =============================================
-- Bireysel Başvurular Tablosunu Kaldırma
-- =============================================

-- Önce foreign key constraint'ini kaldır (eğer varsa)
ALTER TABLE appointments DROP COLUMN IF EXISTS source_individual_request_id;

-- Tabloyu ve ilgili politikaları kaldır
DROP TABLE IF EXISTS individual_requests CASCADE;

SELECT 'Bireysel başvurular tablosu başarıyla kaldırıldı!' as message;