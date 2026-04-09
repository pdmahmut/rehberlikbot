-- Store the source individual request on appointments so completion can update the original request.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS source_individual_request_id UUID REFERENCES individual_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_source_individual_request_id
  ON appointments(source_individual_request_id);
