-- Create job_data table to store worker results separately
CREATE TABLE IF NOT EXISTS job_data (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  data_type VARCHAR(100) NOT NULL, -- website, amazon_reviews, reddit, youtube_comments, persona_profile
  data_content JSONB NOT NULL, -- The actual data from workers
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_data_job_id ON job_data(job_id);
CREATE INDEX IF NOT EXISTS idx_job_data_type ON job_data(data_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_data_job_type ON job_data(job_id, data_type);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_job_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_job_data_updated_at
    BEFORE UPDATE ON job_data
    FOR EACH ROW EXECUTE PROCEDURE update_job_data_updated_at();