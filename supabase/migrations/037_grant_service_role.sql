-- Sunucu anahtarina (service_role) tablo yetkilerini acikca verir.
--
-- Supabase projesi kurulurken "Automatically expose new tables" ayari
-- KAPALI secildi. Bu dogru bir tercih: tarayici veritabanina hic
-- baglanmiyor, her sorgu sunucudan geciyor. Ancak ayar kapaliyken yeni
-- tablolara hicbir role yetki verilmiyor -- sunucunun kendi anahtari dahil.
-- Sonuc: uygulama "42501: permission denied" hatasi aliyordu.
--
-- Burada yalnizca service_role'a yetki veriliyor. anon ve authenticated
-- rolleri disarida birakiliyor; onlarin erisimi 025/027/029/030 numarali
-- goclerde zaten geri alinmisti ve oyle kalmali.
--
-- ALTER DEFAULT PRIVILEGES satirlari, bundan sonra olusturulacak tablolar
-- icin de ayni yetkiyi otomatik verir; boylece her yeni tabloda bu dosyayi
-- tekrar calistirmak gerekmez.

BEGIN;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

COMMIT;

-- Dogrulama: asagidaki sorgu anon ve authenticated icin 0 dondurmeli,
-- service_role icin tablo sayisi kadar satir dondurmeli.
--
--   SELECT grantee, count(DISTINCT table_name)
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon', 'authenticated', 'service_role')
--    GROUP BY grantee;
