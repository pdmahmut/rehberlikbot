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
