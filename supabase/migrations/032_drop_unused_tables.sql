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
