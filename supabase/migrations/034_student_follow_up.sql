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
