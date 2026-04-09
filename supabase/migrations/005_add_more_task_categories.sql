-- Allow the newer task categories in the tasks table.
-- Run this migration against the existing database so inserts with these values succeed.

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_category_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_category_check
  CHECK (
    category IN (
      'genel',
      'randevu',
      'toplanti',
      'veli',
      'ogretmen',
      'okul-ziyareti',
      'kurum-ziyareti',
      'meslek-tanitimi',
      'rapor',
      'diger'
    )
  );
