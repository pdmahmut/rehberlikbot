-- Allow "toplanti" as a valid task category
-- Run this migration against the existing database so new task inserts succeed.

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_category_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_category_check
  CHECK (category IN ('genel', 'randevu', 'toplanti', 'veli', 'ogretmen', 'rapor', 'diger'));
