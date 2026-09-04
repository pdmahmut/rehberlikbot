-- tasks tablosuna sinif rehberligi plani baglantisini ekler.
--
-- Sinif Rehberligi ekrani bir plan planlandiginda ona bagli bir gorev
-- olusturuyor ve daha sonra "bu plana ait gorev var mi?" diye ariyor:
--
--   supabase.from('tasks').select('id').eq('related_guidance_plan_id', ...)
--   supabase.from('tasks').insert({ ..., related_guidance_plan_id: ... })
--
-- Kolon canli veritabaninda vardi ama hicbir goc dosyasi onu
-- olusturmuyordu; elle eklenmis. Sifirdan kurulumda bu ozellik sessizce
-- bozulurdu: gorev eklenemez, mevcut gorev bulunamazdi.
--
-- Plan silindiginde gorevin kendisi silinmez, yalnizca bag kopar; gorev
-- listede kalmaya devam eder.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS related_guidance_plan_id UUID
  REFERENCES public.guidance_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_related_guidance_plan
  ON public.tasks (related_guidance_plan_id);
