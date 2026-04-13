-- =============================================
-- Veli Talepleri Tablosunu Kaldırma
-- =============================================

-- Tabloyu ve ilgili politikaları kaldır
DROP TABLE IF EXISTS parent_meeting_requests CASCADE;

SELECT 'Veli talepleri tablosu başarıyla kaldırıldı!' as message;