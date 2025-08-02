-- Create research_requests table to store complete request data including email
CREATE TABLE IF NOT EXISTS research_requests (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  website_url TEXT NOT NULL,
  amazon_url TEXT,
  keywords TEXT NOT NULL,
  email VARCHAR(255) NOT NULL,
  competitor_urls TEXT[], -- Array of competitor URLs
  plan_id VARCHAR(50) NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  discount_code VARCHAR(50),
  payment_session_id VARCHAR(255),
  amount_paid INTEGER DEFAULT 0,
  original_price INTEGER DEFAULT 0,
  final_price INTEGER DEFAULT 0,
  is_free BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'queued', -- queued, processing, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  persona_report_sent BOOLEAN DEFAULT FALSE,
  persona_analysis TEXT, -- Store the generated persona report
  data_quality TEXT, -- Store data quality info as JSON
  persona_metadata TEXT -- Store metadata as JSON
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_requests_job_id ON research_requests(job_id);
CREATE INDEX IF NOT EXISTS idx_research_requests_email ON research_requests(email);
CREATE INDEX IF NOT EXISTS idx_research_requests_status ON research_requests(status);
CREATE INDEX IF NOT EXISTS idx_research_requests_created_at ON research_requests(created_at);