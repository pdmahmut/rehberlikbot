-- =============================================
-- Gözlem Havuzu Tablosunu Kaldırma
-- =============================================

-- Tabloyu ve ilgili politikaları kaldır
DROP TABLE IF EXISTS observation_pool CASCADE;

SELECT 'Gözlem havuzu tablosu başarıyla kaldırıldı!' as message;