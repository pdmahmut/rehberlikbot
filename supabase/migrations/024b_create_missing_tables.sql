-- Goc dosyalarinda eksik kalan alti tabloyu olusturur.
--
-- Bu tablolar canli veritabaninda vardi ama hicbir goc dosyasi onlari
-- olusturmuyordu; anlasilan Supabase panelinden elle eklenmisler. Sonuc
-- olarak sifirdan kurulum yapmak mumkun degildi: 025 numarali goc
-- parent_meeting_requests tablosunu bulamayip duruyordu.
--
--   guidance_topics          rehberlik konulari
--   guidance_plans           sinif rehberligi planlari (konulara bagli)
--   lesson_hours             okulun ders saatleri
--   parent_meeting_requests  veli talepleri (007'de olusturulup 014'te
--                            silinmis, bir daha olusturulmamisti)
--   class_requests           ogretmenlerin sinif rehberligi talepleri
--   teacher_users            ogretmen giris hesaplari
--
-- Tanimlar canli veritabanindan birebir cikarildi: sutunlar, varsayilanlar,
-- kisitlar, indeksler. 025 ve 029 numarali gocler bu tablolarin guvenligini
-- ayrica ayarliyor; yine de burada da aciliyor ki dosya kendi basina tutarli
-- olsun.

-- --------------------------------------------------------------- konular
CREATE TABLE IF NOT EXISTS public.guidance_topics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  title        text NOT NULL,
  grade_levels integer[] NOT NULL DEFAULT '{}'::integer[],
  status       text DEFAULT 'active'::text
               CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text])),
  notes        text,
  school_year  text DEFAULT '2025-2026'::text
);

-- --------------------------------------------------------------- planlar
CREATE TABLE IF NOT EXISTS public.guidance_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  topic_id      uuid REFERENCES public.guidance_topics(id) ON DELETE CASCADE,
  class_key     text NOT NULL,
  class_display text NOT NULL,
  status        text DEFAULT 'unplanned'::text
                CHECK (status = ANY (ARRAY['unplanned'::text, 'planned'::text, 'completed'::text])),
  plan_date     date,
  lesson_period integer CHECK (lesson_period >= 1 AND lesson_period <= 7),
  completed_at  timestamptz,
  teacher_name  text
);

CREATE INDEX IF NOT EXISTS idx_guidance_plans_topic  ON public.guidance_plans (topic_id);
CREATE INDEX IF NOT EXISTS idx_guidance_plans_class  ON public.guidance_plans (class_key);
CREATE INDEX IF NOT EXISTS idx_guidance_plans_status ON public.guidance_plans (status);
CREATE INDEX IF NOT EXISTS idx_guidance_plans_date   ON public.guidance_plans (plan_date);

-- Ayni tarih ve ders saatine iki PLANLI kayit konamaz. Kisit kismidir:
-- tamamlanmis veya planlanmamis kayitlar bu kurala girmez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_guidance_plans_conflict
  ON public.guidance_plans (plan_date, lesson_period)
  WHERE status = 'planned'::text;

-- ---------------------------------------------------------- ders saatleri
CREATE TABLE IF NOT EXISTS public.lesson_hours (
  id            serial PRIMARY KEY,
  period_number integer NOT NULL UNIQUE,
  start_time    text NOT NULL,
  end_time      text NOT NULL,
  updated_at    timestamptz DEFAULT now()
);

-- Okulun zil saatleri. Ogrenci verisi degil, yil boyunca degismeyen ayardir.
INSERT INTO public.lesson_hours (period_number, start_time, end_time) VALUES
  (1, '07:20', '07:55'),
  (2, '08:05', '08:40'),
  (3, '08:50', '09:25'),
  (4, '09:35', '10:10'),
  (5, '10:20', '10:55'),
  (6, '11:05', '11:40'),
  (7, '11:50', '12:25')
ON CONFLICT (period_number) DO NOTHING;

-- ---------------------------------------------------------- veli talepleri
CREATE TABLE IF NOT EXISTS public.parent_meeting_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  student_name      text NOT NULL,
  class_key         text,
  class_display     text,
  parent_name       text,
  parent_relation   text,
  parent_phone      text,
  request_type      text DEFAULT 'gorusme'::text
                    CHECK (request_type = ANY (ARRAY['gorusme'::text, 'bilgilendirme'::text, 'destek'::text, 'acil'::text, 'diger'::text])),
  subject           text NOT NULL,
  detail            text NOT NULL,
  status            text DEFAULT 'new'::text
                    CHECK (status = ANY (ARRAY['new'::text, 'reviewing'::text, 'scheduled'::text, 'closed'::text])),
  preferred_contact text,
  note              text,
  request_date      date
);

CREATE INDEX IF NOT EXISTS idx_parent_meeting_requests_student    ON public.parent_meeting_requests (student_name);
CREATE INDEX IF NOT EXISTS idx_parent_meeting_requests_status     ON public.parent_meeting_requests (status);
CREATE INDEX IF NOT EXISTS idx_parent_meeting_requests_created_at ON public.parent_meeting_requests (created_at);


-- ------------------------------------------------------- sinif talepleri
CREATE TABLE IF NOT EXISTS public.class_requests (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz,
  class_key                 text NOT NULL,
  class_display             text NOT NULL,
  teacher_name              text NOT NULL,
  topic                     text,
  description               text,
  teacher_description       text,
  admin_category            text,
  admin_category_normalized text,
  status                    text NOT NULL DEFAULT 'pending'::text
                            CHECK (status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'completed'::text, 'rejected'::text])),
  scheduled_date            date,
  lesson_slot               integer,
  lesson_teacher            text,
  feedback                  text
);

CREATE INDEX IF NOT EXISTS idx_class_requests_admin_category_normalized
  ON public.class_requests (admin_category_normalized);

-- --------------------------------------------------- ogretmen giris hesaplari
CREATE TABLE IF NOT EXISTS public.teacher_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz DEFAULT now(),
  username        text NOT NULL UNIQUE,
  teacher_name    text,
  class_key       text,
  class_display   text,
  password_cipher text,
  password_lookup text
);

-- Ayni sifre iki ogretmene verilemez: giris yalnizca sifreyle yapildigi icin
-- sifrenin kimi isaret ettigi tekil olmali. NULL olanlar kurala girmez.
CREATE UNIQUE INDEX IF NOT EXISTS teacher_users_password_lookup_key
  ON public.teacher_users (password_lookup)
  WHERE password_lookup IS NOT NULL;

-- ------------------------------------------------------------------ guvenlik
-- Altisi da yalnizca sunucudan erisilir. Politika tanimlanmaz: RLS acik ve
-- zorunlu, politika yok demek, service_role disinda kimse okuyamaz demektir.
ALTER TABLE public.guidance_topics          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guidance_topics          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.guidance_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guidance_plans           FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.lesson_hours             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_hours             FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.parent_meeting_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_meeting_requests  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.class_requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_requests           FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.teacher_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_users            FORCE  ROW LEVEL SECURITY;
