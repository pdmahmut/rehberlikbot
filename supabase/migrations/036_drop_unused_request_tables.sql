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
