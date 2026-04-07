-- Update time fields to TEXT for lesson slots
-- Change appointments.start_time from TIME to TEXT
-- Change class_activities.activity_time from TIME to TEXT

ALTER TABLE appointments ALTER COLUMN start_time TYPE TEXT;
ALTER TABLE class_activities ALTER COLUMN activity_time TYPE TEXT;