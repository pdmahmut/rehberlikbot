-- =============================================
-- Öğrenci Bildirimleri Tablosunu Kaldırma
-- =============================================

-- Tabloyu ve ilgili politikaları kaldır
DROP TABLE IF EXISTS student_incidents CASCADE;

SELECT 'Öğrenci bildirimleri tablosu başarıyla kaldırıldı!' as message;