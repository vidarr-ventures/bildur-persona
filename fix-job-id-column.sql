-- Fix job ID column from UUID to TEXT to support custom job IDs
ALTER TABLE jobs ALTER COLUMN id TYPE TEXT;

-- Also ensure other tables that reference job_id use TEXT
-- research_requests already uses VARCHAR(255) which is correct
-- job_data table if it exists should also use TEXT for job_id