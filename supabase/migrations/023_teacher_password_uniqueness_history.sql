CREATE TABLE IF NOT EXISTS public.teacher_password_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  teacher_user_id UUID NOT NULL REFERENCES public.teacher_users(id) ON DELETE CASCADE,
  normalized_password TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_password_history_unique_normalized
  ON public.teacher_password_history (normalized_password);

CREATE INDEX IF NOT EXISTS idx_teacher_password_history_teacher_user_id
  ON public.teacher_password_history (teacher_user_id);

ALTER TABLE public.teacher_users
  ADD CONSTRAINT teacher_users_password_min_length_check
  CHECK (password_hash IS NULL OR char_length(BTRIM(password_hash)) >= 4);

WITH normalized_passwords AS (
  SELECT
    id,
    LOWER(BTRIM(password_hash)) AS normalized_password,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM(password_hash))
      ORDER BY created_at, id
    ) AS row_num
  FROM public.teacher_users
  WHERE password_hash IS NOT NULL
    AND BTRIM(password_hash) <> ''
)
UPDATE public.teacher_users tu
SET password_hash = CONCAT(BTRIM(tu.password_hash), '_', SUBSTRING(tu.id::text, 1, 4))
FROM normalized_passwords np
WHERE tu.id = np.id
  AND np.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_users_password_unique_normalized
  ON public.teacher_users ((LOWER(BTRIM(password_hash))))
  WHERE password_hash IS NOT NULL AND BTRIM(password_hash) <> '';

INSERT INTO public.teacher_password_history (teacher_user_id, normalized_password)
SELECT tu.id, LOWER(BTRIM(tu.password_hash))
FROM public.teacher_users tu
WHERE tu.password_hash IS NOT NULL
  AND BTRIM(tu.password_hash) <> ''
ON CONFLICT (normalized_password) DO NOTHING;
