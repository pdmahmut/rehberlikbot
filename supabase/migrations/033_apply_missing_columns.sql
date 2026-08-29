-- 033: Yazilmis ama veritabanina hic uygulanmamis kolonlari tamamla.
--
-- Migration 010, 011 ve 019 depoda duruyor fakat uzaktaki veritabanina
-- uygulanmamis. Kod bu kolonlari kullanmak uzere yazildigi icin, kolonlar
-- olmayinca sessizce yedek yollara dusuyordu:
--
--   - Randevu, kaynagi olan basvuruya (yonlendirme/veli talebi/olay) hic
--     baglanmiyordu. Bu yuzden gorusme tamamlandiginda kaynak basvurunun
--     durumu guncellenemiyordu; "Gorusme Sonucu" surekli bos kaliyordu.
--   - referrals tablosunda status kolonu yoktu; basvuru durumu yalnizca
--     isim eslestirmesiyle ekranda hesaplaniyordu.
--
-- Yalnizca GERCEKTEN eksik olanlar ekleniyor. Diger tablolarda status
-- kolonu zaten mevcut, onlara dokunulmuyor.

BEGIN;

-- ---------------------------------------------------------------------------
-- appointments: kaynak basvuru baglantisi  (migration 010 + 011)
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS source_application_type TEXT,
  ADD COLUMN IF NOT EXISTS source_application_id TEXT,
  ADD COLUMN IF NOT EXISTS source_individual_request_id UUID;

CREATE INDEX IF NOT EXISTS idx_appointments_source_application
  ON public.appointments (source_application_type, source_application_id);

CREATE INDEX IF NOT EXISTS idx_appointments_source_individual_request
  ON public.appointments (source_individual_request_id);

-- ---------------------------------------------------------------------------
-- referrals: basvuru durumu  (migration 019)
-- ---------------------------------------------------------------------------
-- Kodun yazdigi degerler (guidanceApplications.ts / teacher_referral):
--   "Bekliyor", "Randevu verildi", "Görüşüldü"
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Bekliyor';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_status_check') THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_status_check
      CHECK (status IN ('Bekliyor', 'Görüşüldü', 'Randevu verildi'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals (status);

-- ---------------------------------------------------------------------------
-- observation_pool: kaynak takibi  (migration 011)
-- ---------------------------------------------------------------------------
ALTER TABLE public.observation_pool
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'observation',
  ADD COLUMN IF NOT EXISTS source_record_id TEXT,
  ADD COLUMN IF NOT EXISTS source_record_table TEXT;

UPDATE public.observation_pool
   SET source_type = 'observation'
 WHERE source_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observation_pool_source_type_check') THEN
    ALTER TABLE public.observation_pool
      ADD CONSTRAINT observation_pool_source_type_check
      CHECK (source_type IN ('observation', 'student_report', 'teacher_referral',
                             'parent_request', 'self_application'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_observation_pool_source
  ON public.observation_pool (source_type, source_record_id);

COMMIT;
