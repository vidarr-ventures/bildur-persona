-- Add persona storage columns to research_requests table
ALTER TABLE research_requests 
ADD COLUMN IF NOT EXISTS persona_analysis TEXT,
ADD COLUMN IF NOT EXISTS data_quality TEXT,
ADD COLUMN IF NOT EXISTS persona_metadata TEXT;