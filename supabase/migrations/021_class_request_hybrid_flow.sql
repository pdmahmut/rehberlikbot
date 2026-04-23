CREATE TABLE IF NOT EXISTS public.class_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  teacher_name TEXT NOT NULL,
  class_key TEXT NOT NULL,
  class_display TEXT NOT NULL,
  topic TEXT,
  description TEXT,
  teacher_description TEXT,
  admin_category TEXT,
  admin_category_normalized TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'rejected')),
  scheduled_date DATE,
  lesson_slot INTEGER,
  lesson_teacher TEXT,
  feedback TEXT
);

ALTER TABLE public.class_requests
  ALTER COLUMN topic DROP NOT NULL;

ALTER TABLE public.class_requests
  ADD COLUMN IF NOT EXISTS teacher_description TEXT,
  ADD COLUMN IF NOT EXISTS admin_category TEXT,
  ADD COLUMN IF NOT EXISTS admin_category_normalized TEXT,
  ADD COLUMN IF NOT EXISTS lesson_teacher TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.class_request_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  label TEXT NOT NULL,
  normalized_label TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_class_requests_admin_category_normalized
  ON public.class_requests (admin_category_normalized);

CREATE INDEX IF NOT EXISTS idx_class_request_categories_normalized_label
  ON public.class_request_categories (normalized_label);

UPDATE public.class_requests
SET teacher_description = NULLIF(BTRIM(description), '')
WHERE teacher_description IS NULL
  AND description IS NOT NULL;

UPDATE public.class_requests
SET admin_category = NULLIF(BTRIM(topic), '')
WHERE admin_category IS NULL
  AND topic IS NOT NULL;

UPDATE public.class_requests
SET admin_category_normalized = LOWER(REGEXP_REPLACE(BTRIM(admin_category), '\s+', ' ', 'g'))
WHERE admin_category IS NOT NULL
  AND (
    admin_category_normalized IS NULL
    OR admin_category_normalized = ''
  );

INSERT INTO public.class_request_categories (label, normalized_label)
SELECT category_seed.label, category_seed.normalized_label
FROM (
  SELECT DISTINCT ON (LOWER(REGEXP_REPLACE(BTRIM(admin_category), '\s+', ' ', 'g')))
    BTRIM(admin_category) AS label,
    LOWER(REGEXP_REPLACE(BTRIM(admin_category), '\s+', ' ', 'g')) AS normalized_label
  FROM public.class_requests
  WHERE admin_category IS NOT NULL
    AND BTRIM(admin_category) <> ''
  ORDER BY LOWER(REGEXP_REPLACE(BTRIM(admin_category), '\s+', ' ', 'g')), created_at
) AS category_seed
ON CONFLICT (normalized_label) DO NOTHING;

ALTER TABLE public.class_request_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_request_categories_select_policy ON public.class_request_categories;
DROP POLICY IF EXISTS class_request_categories_insert_policy ON public.class_request_categories;
DROP POLICY IF EXISTS class_request_categories_update_policy ON public.class_request_categories;
DROP POLICY IF EXISTS class_request_categories_delete_policy ON public.class_request_categories;

CREATE POLICY class_request_categories_select_policy
ON public.class_request_categories
FOR SELECT
USING (public.app_request_header('x-app-role') = 'admin');

CREATE POLICY class_request_categories_insert_policy
ON public.class_request_categories
FOR INSERT
WITH CHECK (public.app_request_header('x-app-role') = 'admin');

CREATE POLICY class_request_categories_update_policy
ON public.class_request_categories
FOR UPDATE
USING (public.app_request_header('x-app-role') = 'admin')
WITH CHECK (public.app_request_header('x-app-role') = 'admin');

CREATE POLICY class_request_categories_delete_policy
ON public.class_request_categories
FOR DELETE
USING (public.app_request_header('x-app-role') = 'admin');
